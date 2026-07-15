/**
 * GET    /api/permissions/role/[roleKey] — List all permissions for a role (requires auth)
 * PUT    /api/permissions/role/[roleKey] — Replace all role permissions (requires admin)
 * POST   /api/permissions/role/[roleKey] — Add a single permission to a role (requires admin)
 * DELETE /api/permissions/role/[roleKey] — Remove a permission from a role (requires admin, ?permissionKey=xxx)
 *
 * Note: In Next.js 16, `params` is a Promise and must be awaited.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roleKey: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roleKey } = await params;
  const lowerKey = roleKey.toLowerCase();

  const role = await prisma.role.findUnique({
    where: { key: lowerKey },
    select: { id: true, key: true, name: true },
  });

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: role.id },
    select: { permissionKey: true, effect: true, createdAt: true },
  });

  return NextResponse.json({
    role: { key: role.key, name: role.name },
    permissions: rolePermissions,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ roleKey: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { roleKey } = await params;
  const lowerKey = roleKey.toLowerCase();

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

  const role = await prisma.role.findUnique({
    where: { key: lowerKey },
    select: { id: true },
  });
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
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

  // Replace: delete all existing role permissions, then create the new set
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });

    if (permissions.length > 0) {
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({
          roleId: role.id,
          permissionKey: p.key,
          effect: p.effect === "deny" ? "deny" : "allow",
        })),
      });
    }
  });

  const updated = await prisma.rolePermission.findMany({
    where: { roleId: role.id },
    select: { permissionKey: true, effect: true },
  });

  return NextResponse.json({
    roleKey: lowerKey,
    permissions: updated,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roleKey: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { roleKey } = await params;
  const lowerKey = roleKey.toLowerCase();

  let body: { permissionKey?: string; effect?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { permissionKey, effect } = body;

  if (!permissionKey || typeof permissionKey !== "string") {
    return NextResponse.json({ error: "permissionKey is required" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({
    where: { key: lowerKey },
    select: { id: true },
  });
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const permission = await prisma.permission.findUnique({
    where: { key: permissionKey },
    select: { key: true },
  });
  if (!permission) {
    return NextResponse.json(
      { error: `Permission "${permissionKey}" not found` },
      { status: 404 },
    );
  }

  // Upsert: if the role already has this permission, update the effect; otherwise create
  const existing = await prisma.rolePermission.findFirst({
    where: { roleId: role.id, permissionKey },
  });

  const effectValue = effect === "deny" ? "deny" : "allow";

  let result;
  if (existing) {
    result = await prisma.rolePermission.update({
      where: { id: existing.id },
      data: { effect: effectValue },
    });
  } else {
    result = await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionKey,
        effect: effectValue,
      },
    });
  }

  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roleKey: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { roleKey } = await params;
  const lowerKey = roleKey.toLowerCase();

  const { searchParams } = new URL(request.url);
  const permissionKey = searchParams.get("permissionKey");

  if (!permissionKey) {
    return NextResponse.json(
      { error: "permissionKey query parameter is required" },
      { status: 400 },
    );
  }

  const role = await prisma.role.findUnique({
    where: { key: lowerKey },
    select: { id: true },
  });
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const existing = await prisma.rolePermission.findFirst({
    where: { roleId: role.id, permissionKey },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Permission not assigned to this role" },
      { status: 404 },
    );
  }

  await prisma.rolePermission.delete({ where: { id: existing.id } });

  return NextResponse.json({ success: true });
}