/**
 * GET /api/permissions/user/[userId] — List direct user permission overrides (requires admin)
 * PUT /api/permissions/user/[userId] — Set user permission overrides (requires admin)
 *
 * Replaces all user-level overrides with the provided set.
 *
 * Note: In Next.js 16, `params` is a Promise and must be awaited.
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const overrides = await prisma.userPermission.findMany({
    where: { userId },
    select: { id: true, permissionKey: true, effect: true, createdAt: true },
  });

  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role },
    permissions: overrides,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { userId } = await params;

  let body: { permissions?: Array<{ key: string; effect: string }> };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const permissions = body.permissions;
  if (!Array.isArray(permissions)) {
    return NextResponse.json(
      { error: "permissions must be an array of { key, effect }" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Validate that all permission keys exist
  const keys = permissions.map((p) => p.key);
  if (keys.length > 0) {
    const existingPerms = await prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { key: true },
    });
    const existingKeys = new Set(existingPerms.map((p) => p.key));
    const missing = keys.filter((k) => !existingKeys.has(k));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Unknown permission keys: ${missing.join(", ")}` },
        { status: 400 },
      );
    }
  }

  // Replace: delete all existing user overrides, then create the new set
  await prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({ where: { userId } });

    if (permissions.length > 0) {
      await tx.userPermission.createMany({
        data: permissions.map((p) => ({
          userId,
          permissionKey: p.key,
          effect: p.effect === "deny" ? "deny" : "allow",
        })),
      });
    }
  });

  const updated = await prisma.userPermission.findMany({
    where: { userId },
    select: { permissionKey: true, effect: true },
  });

  return NextResponse.json({
    userId,
    permissions: updated,
  });
}