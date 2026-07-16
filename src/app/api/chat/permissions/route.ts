/**
 * POST /api/chat/permissions — Permission management via chat (requires admin session)
 *
 * This route lets Archie (the Hermes agent) manage permissions programmatically
 * when Jake asks via chat. All actions require admin authentication.
 *
 * Actions:
 *   { action: "list" }
 *   { action: "assign", roleKey, permissionKey, effect }
 *   { action: "remove", roleKey, permissionKey }
 *   { action: "set_role", roleKey, permissions: [{ key, effect }] }
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
    case "list":
      return handleList();
    case "assign":
      return handleAssign(body);
    case "remove":
      return handleRemove(body);
    case "set_role":
      return handleSetRole(body);
    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );
  }
}

// --- Action handlers ---

async function handleList() {
  // Fetch all permissions, grouped by category
  const permissions = await prisma.permission.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  // Fetch all roles
  const roles = await prisma.role.findMany({
    select: { id: true, key: true, name: true, isAdmin: true },
    orderBy: { key: "asc" },
  });

  // Fetch all role-permission assignments
  const rolePermissions = await prisma.rolePermission.findMany({
    select: {
      roleId: true,
      permissionKey: true,
      effect: true,
    },
  });

  // Group permissions by category
  const grouped: Record<string, typeof permissions> = {};
  for (const p of permissions) {
    const cat = p.category ?? "Uncategorized";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }

  // Map role permissions by roleKey
  const roleKeyToId = new Map(roles.map((r) => [r.key, r.id]));
  const roleKeyToPerms: Record<string, Array<{ permissionKey: string; effect: string }>> = {};
  for (const rp of rolePermissions) {
    // Find the role key for this roleId
    for (const [rKey, rId] of roleKeyToId) {
      if (rId === rp.roleId) {
        if (!roleKeyToPerms[rKey]) roleKeyToPerms[rKey] = [];
        roleKeyToPerms[rKey].push({ permissionKey: rp.permissionKey, effect: rp.effect });
        break;
      }
    }
  }

  return NextResponse.json({
    success: true,
    action: "list",
    permissions: grouped,
    roles: roles.map((r) => ({
      key: r.key,
      name: r.name,
      isAdmin: r.isAdmin,
      permissions: roleKeyToPerms[r.key] ?? [],
    })),
  });
}

async function handleAssign(body: Record<string, unknown>) {
  const roleKey = body.roleKey as string | undefined;
  const permissionKey = body.permissionKey as string | undefined;
  const effect = body.effect as string | undefined;

  if (!roleKey || typeof roleKey !== "string") {
    return NextResponse.json({ error: "roleKey is required" }, { status: 400 });
  }
  if (!permissionKey || typeof permissionKey !== "string") {
    return NextResponse.json({ error: "permissionKey is required" }, { status: 400 });
  }

  const lowerRoleKey = roleKey.toLowerCase();
  const effectValue = effect === "deny" ? "deny" : "allow";

  const role = await prisma.role.findUnique({
    where: { key: lowerRoleKey },
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

  // Upsert
  const existing = await prisma.rolePermission.findFirst({
    where: { roleId: role.id, permissionKey },
  });

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

  return NextResponse.json({
    success: true,
    action: "assign",
    roleKey: lowerRoleKey,
    permissionKey,
    effect: effectValue,
  });
}

async function handleRemove(body: Record<string, unknown>) {
  const roleKey = body.roleKey as string | undefined;
  const permissionKey = body.permissionKey as string | undefined;

  if (!roleKey || typeof roleKey !== "string") {
    return NextResponse.json({ error: "roleKey is required" }, { status: 400 });
  }
  if (!permissionKey || typeof permissionKey !== "string") {
    return NextResponse.json({ error: "permissionKey is required" }, { status: 400 });
  }

  const lowerRoleKey = roleKey.toLowerCase();

  const role = await prisma.role.findUnique({
    where: { key: lowerRoleKey },
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

  return NextResponse.json({
    success: true,
    action: "remove",
    roleKey: lowerRoleKey,
    permissionKey,
  });
}

async function handleSetRole(body: Record<string, unknown>) {
  const roleKey = body.roleKey as string | undefined;
  const permissions = body.permissions as Array<{ key: string; effect: string }> | undefined;

  if (!roleKey || typeof roleKey !== "string") {
    return NextResponse.json({ error: "roleKey is required" }, { status: 400 });
  }
  if (!Array.isArray(permissions)) {
    return NextResponse.json(
      { error: "permissions must be an array of { key, effect }" },
      { status: 400 },
    );
  }

  const lowerRoleKey = roleKey.toLowerCase();

  const role = await prisma.role.findUnique({
    where: { key: lowerRoleKey },
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

  // Replace: delete all existing, then create new set
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
    success: true,
    action: "set_role",
    roleKey: lowerRoleKey,
    permissions: updated,
  });
}