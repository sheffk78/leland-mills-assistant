/**
 * GET  /api/skills/[id]/version — List all versions of a skill (requires auth)
 * POST /api/skills/[id]/version — Roll back to a specific version (requires admin)
 *
 * Note: In Next.js 16, `params` is a Promise and must be awaited.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const skill = await prisma.skill.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const versions = await prisma.skillVersion.findMany({
    where: { skillId: id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      content: true,
      createdBy: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    skillId: id,
    versions,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  let body: { version?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetVersion = body.version;
  if (typeof targetVersion !== "number" || targetVersion < 1) {
    return NextResponse.json({ error: "version must be a positive integer" }, { status: 400 });
  }

  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  // Find the target version snapshot
  const versionSnapshot = await prisma.skillVersion.findFirst({
    where: { skillId: id, version: targetVersion },
  });
  if (!versionSnapshot) {
    return NextResponse.json(
      { error: `Version ${targetVersion} not found for this skill` },
      { status: 404 },
    );
  }

  // Roll back: set content to the old version's content, bump the version counter,
  // and create a new SkillVersion row so the rollback itself is tracked.
  const newVersion = skill.version + 1;

  await prisma.$transaction(async (tx) => {
    await tx.skill.update({
      where: { id },
      data: {
        content: versionSnapshot.content,
        version: newVersion,
      },
    });
    await tx.skillVersion.create({
      data: {
        skillId: id,
        version: newVersion,
        content: versionSnapshot.content,
        createdBy: session.user.id,
      },
    });
  });

  const updated = await prisma.skill.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { version: "desc" },
        select: { id: true, version: true, createdBy: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({
    success: true,
    rolledBackTo: targetVersion,
    newVersion,
    skill: updated,
  });
}