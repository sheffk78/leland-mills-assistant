/**
 * POST /api/chat/skills — Skill management via chat (requires admin session)
 *
 * This route lets Archie (the Hermes agent) manage skills programmatically
 * when Jake asks via chat. All actions require admin authentication.
 *
 * Actions:
 *   { action: "create", key, name, description, category, content, roleKeys[] }
 *   { action: "update", skillId, content, name?, description? }
 *   { action: "assign", skillId, roleKey }
 *   { action: "unassign", skillId, roleKey }
 *   { action: "list" }
 *   { action: "toggle", skillId, isActive }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return null;
  }
  return session;
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action as string | undefined;
  if (!action) {
    return NextResponse.json({ error: "Missing 'action' field" }, { status: 400 });
  }

  switch (action) {
    case "create":
      return handleCreate(body, session.user.id);
    case "update":
      return handleUpdate(body, session.user.id);
    case "assign":
      return handleAssign(body);
    case "unassign":
      return handleUnassign(body);
    case "list":
      return handleList();
    case "toggle":
      return handleToggle(body);
    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );
  }
}

// --- Action handlers ---

async function handleCreate(body: Record<string, unknown>, userId: string) {
  const key = body.key as string | undefined;
  const name = body.name as string | undefined;
  const description = (body.description as string | undefined) ?? null;
  const category = (body.category as string | undefined) ?? null;
  const content = (body.content as string | undefined) ?? null;
  const roleKeys = (body.roleKeys as string[] | undefined) ?? [];

  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Skill key is required" }, { status: 400 });
  }
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Skill name is required" }, { status: 400 });
  }

  const lowerKey = key.toLowerCase();

  const existing = await prisma.skill.findUnique({ where: { key: lowerKey } });
  if (existing) {
    return NextResponse.json(
      { error: `A skill with key "${lowerKey}" already exists` },
      { status: 409 },
    );
  }

  // Validate role keys if provided
  if (roleKeys.length > 0) {
    const lowerRoleKeys = roleKeys.map((r) => r.toLowerCase());
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

  const skill = await prisma.$transaction(async (tx) => {
    const created = await tx.skill.create({
      data: {
        key: lowerKey,
        name,
        description,
        category,
        content,
        version: 1,
      },
    });

    await tx.skillVersion.create({
      data: {
        skillId: created.id,
        version: 1,
        content,
        createdBy: userId,
      },
    });

    if (roleKeys.length > 0) {
      await tx.skillRoleAssignment.createMany({
        data: roleKeys.map((rk) => ({
          skillId: created.id,
          roleKey: rk.toLowerCase(),
          isEnabled: true,
        })),
      });
    }

    return created;
  });

  const skillWithAssignments = await prisma.skill.findUnique({
    where: { id: skill.id },
    include: {
      roleAssignments: {
        select: { roleKey: true, isEnabled: true, assignedAt: true },
      },
    },
  });

  return NextResponse.json({
    success: true,
    action: "create",
    skill: skillWithAssignments,
  }, { status: 201 });
}

async function handleUpdate(body: Record<string, unknown>, userId: string) {
  const skillId = body.skillId as string | undefined;
  if (!skillId) {
    return NextResponse.json({ error: "skillId is required" }, { status: 400 });
  }

  const content = body.content as string | undefined;
  const name = body.name as string | undefined;
  const description = body.description as string | undefined;

  const existing = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!existing) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description || null;
  if (content !== undefined) updateData.content = content;

  const contentChanged = content !== undefined && content !== existing.content;

  if (contentChanged) {
    const newVersion = existing.version + 1;
    updateData.version = newVersion;

    await prisma.$transaction(async (tx) => {
      await tx.skill.update({ where: { id: skillId }, data: updateData });
      await tx.skillVersion.create({
        data: {
          skillId,
          version: newVersion,
          content: content ?? null,
          createdBy: userId,
        },
      });
    });
  } else {
    await prisma.skill.update({ where: { id: skillId }, data: updateData });
  }

  const updated = await prisma.skill.findUnique({
    where: { id: skillId },
    include: {
      roleAssignments: {
        select: { roleKey: true, isEnabled: true, assignedAt: true },
      },
    },
  });

  return NextResponse.json({
    success: true,
    action: "update",
    skill: updated,
  });
}

async function handleAssign(body: Record<string, unknown>) {
  const skillId = body.skillId as string | undefined;
  const roleKey = body.roleKey as string | undefined;

  if (!skillId) {
    return NextResponse.json({ error: "skillId is required" }, { status: 400 });
  }
  if (!roleKey || typeof roleKey !== "string") {
    return NextResponse.json({ error: "roleKey is required" }, { status: 400 });
  }

  const lowerRoleKey = roleKey.toLowerCase();

  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const role = await prisma.role.findUnique({
    where: { key: lowerRoleKey },
    select: { key: true },
  });
  if (!role) {
    return NextResponse.json({ error: `Unknown role key: ${lowerRoleKey}` }, { status: 400 });
  }

  // Upsert the assignment
  const existingAssignment = await prisma.skillRoleAssignment.findFirst({
    where: { skillId, roleKey: lowerRoleKey },
  });

  if (existingAssignment) {
    await prisma.skillRoleAssignment.update({
      where: { id: existingAssignment.id },
      data: { isEnabled: true },
    });
  } else {
    await prisma.skillRoleAssignment.create({
      data: { skillId, roleKey: lowerRoleKey, isEnabled: true },
    });
  }

  return NextResponse.json({
    success: true,
    action: "assign",
    skillId,
    roleKey: lowerRoleKey,
  });
}

async function handleUnassign(body: Record<string, unknown>) {
  const skillId = body.skillId as string | undefined;
  const roleKey = body.roleKey as string | undefined;

  if (!skillId) {
    return NextResponse.json({ error: "skillId is required" }, { status: 400 });
  }
  if (!roleKey || typeof roleKey !== "string") {
    return NextResponse.json({ error: "roleKey is required" }, { status: 400 });
  }

  const lowerRoleKey = roleKey.toLowerCase();

  const existing = await prisma.skillRoleAssignment.findFirst({
    where: { skillId, roleKey: lowerRoleKey },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Assignment not found" },
      { status: 404 },
    );
  }

  await prisma.skillRoleAssignment.delete({ where: { id: existing.id } });

  return NextResponse.json({
    success: true,
    action: "unassign",
    skillId,
    roleKey: lowerRoleKey,
  });
}

async function handleList() {
  const skills = await prisma.skill.findMany({
    include: {
      roleAssignments: {
        select: {
          roleKey: true,
          isEnabled: true,
          assignedAt: true,
        },
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    success: true,
    action: "list",
    skills,
  });
}

async function handleToggle(body: Record<string, unknown>) {
  const skillId = body.skillId as string | undefined;
  const isActive = body.isActive as boolean | undefined;

  if (!skillId) {
    return NextResponse.json({ error: "skillId is required" }, { status: 400 });
  }
  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive (boolean) is required" }, { status: 400 });
  }

  const existing = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!existing) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  await prisma.skill.update({
    where: { id: skillId },
    data: { isActive },
  });

  return NextResponse.json({
    success: true,
    action: "toggle",
    skillId,
    isActive,
  });
}