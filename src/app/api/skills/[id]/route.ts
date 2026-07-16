/**
 * GET    /api/skills/[id] — Get a single skill with full content and version history (requires auth)
 * PUT    /api/skills/[id] — Update a skill (requires admin). Creates a new SkillVersion.
 * DELETE /api/skills/[id] — Delete a skill (requires admin). System skills are archived, not deleted.
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
    include: {
      roleAssignments: {
        select: { roleKey: true, isEnabled: true, assignedAt: true },
      },
      versions: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          createdBy: true,
          createdAt: true,
        },
      },
    },
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  return NextResponse.json(skill);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  let body: {
    name?: string;
    description?: string;
    category?: string;
    content?: string;
    isActive?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.skill.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.name) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description || null;
  if (body.category !== undefined) updateData.category = body.category || null;
  if (body.content !== undefined) updateData.content = body.content;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  // Determine if we need a new version (content changed)
  const contentChanged =
    body.content !== undefined && body.content !== existing.content;

  // Bump version and create a SkillVersion row if content changed
  if (contentChanged) {
    const newVersion = existing.version + 1;
    updateData.version = newVersion;

    await prisma.$transaction(async (tx) => {
      await tx.skill.update({ where: { id }, data: updateData });
      await tx.skillVersion.create({
        data: {
          skillId: id,
          version: newVersion,
          content: body.content ?? null,
          createdBy: session.user.name ?? session.user.email ?? session.user.id,
        },
      });
    });
  } else {
    await prisma.skill.update({ where: { id }, data: updateData });
  }

  const updated = await prisma.skill.findUnique({
    where: { id },
    include: {
      roleAssignments: {
        select: { roleKey: true, isEnabled: true, assignedAt: true },
      },
      versions: {
        orderBy: { version: "desc" },
        select: { id: true, version: true, createdBy: true, createdAt: true },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.skill.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  // System skills cannot be deleted — archive instead
  if (existing.isSystem) {
    await prisma.skill.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({
      success: true,
      archived: true,
      message: `System skill "${existing.key}" archived (isActive set to false)`,
    });
  }

  await prisma.skill.delete({ where: { id } });

  return NextResponse.json({ success: true });
}