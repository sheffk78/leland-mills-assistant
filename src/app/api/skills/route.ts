/**
 * GET  /api/skills — List all skills (requires auth). Optional ?category= filter.
 * POST /api/skills — Create a new skill (requires admin).
 *
 * GET returns skills with their roleAssignments.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const skills = await prisma.skill.findMany({
    where: category ? { category } : undefined,
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

  return NextResponse.json(skills);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: {
    key?: string;
    name?: string;
    description?: string;
    category?: string;
    content?: string;
    roleKeys?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { key, name, description, category, content, roleKeys } = body;

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
  if (roleKeys && roleKeys.length > 0) {
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

  // Create the skill + initial version + role assignments in a transaction
  const skill = await prisma.$transaction(async (tx) => {
    const created = await tx.skill.create({
      data: {
        key: lowerKey,
        name,
        description: description ?? null,
        category: category ?? null,
        content: content ?? null,
        version: 1,
      },
    });

    // Create initial version snapshot
    await tx.skillVersion.create({
      data: {
        skillId: created.id,
        version: 1,
        content: content ?? null,
        createdBy: session.user.name ?? session.user.email ?? session.user.id,
      },
    });

    // Assign to roles if provided
    if (roleKeys && roleKeys.length > 0) {
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

  // Re-fetch with relations
  const skillWithAssignments = await prisma.skill.findUnique({
    where: { id: skill.id },
    include: {
      roleAssignments: {
        select: { roleKey: true, isEnabled: true, assignedAt: true },
      },
    },
  });

  return NextResponse.json(skillWithAssignments, { status: 201 });
}