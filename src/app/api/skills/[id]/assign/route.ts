/**
 * POST   /api/skills/[id]/assign — Assign a skill to roles (requires admin)
 * DELETE /api/skills/[id]/assign  — Unassign a skill from a role (requires admin)
 *
 * Note: In Next.js 16, `params` is a Promise and must be awaited.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  let body: {
    roleKeys?: string[];
    isEnabled?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { roleKeys, isEnabled } = body;

  if (!Array.isArray(roleKeys)) {
    return NextResponse.json({ error: "roleKeys must be an array" }, { status: 400 });
  }

  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const lowerRoleKeys = roleKeys.map((r) => r.toLowerCase());

  // Validate role keys exist
  if (lowerRoleKeys.length > 0) {
    const existingRoles = await prisma.role.findMany({
      where: { key: { in: lowerRoleKeys } },
      select: { key: true },
    });
    const existingRoleKeys = new Set(existingRoles.map((r) => r.key));
    const missing = lowerRoleKeys.filter((k) => !existingRoleKeys.has(k));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Unknown role keys: ${missing.join(", ")}` },
        { status: 400 },
      );
    }
  }

  const enabled = isEnabled !== undefined ? isEnabled : true;

  // Upsert each assignment
  await prisma.$transaction(async (tx) => {
    for (const roleKey of lowerRoleKeys) {
      const existing = await tx.skillRoleAssignment.findFirst({
        where: { skillId: id, roleKey },
      });
      if (existing) {
        await tx.skillRoleAssignment.update({
          where: { id: existing.id },
          data: { isEnabled: enabled },
        });
      } else {
        await tx.skillRoleAssignment.create({
          data: { skillId: id, roleKey, isEnabled: enabled },
        });
      }
    }
  });

  const updated = await prisma.skillRoleAssignment.findMany({
    where: { skillId: id },
    select: { roleKey: true, isEnabled: true, assignedAt: true },
  });

  return NextResponse.json({
    skillId: id,
    assignments: updated,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  let body: { roleKey?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { roleKey } = body;

  if (!roleKey || typeof roleKey !== "string") {
    return NextResponse.json({ error: "roleKey is required" }, { status: 400 });
  }

  const lowerRoleKey = roleKey.toLowerCase();

  const existing = await prisma.skillRoleAssignment.findFirst({
    where: { skillId: id, roleKey: lowerRoleKey },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Assignment not found" },
      { status: 404 },
    );
  }

  await prisma.skillRoleAssignment.delete({ where: { id: existing.id } });

  return NextResponse.json({ success: true });
}