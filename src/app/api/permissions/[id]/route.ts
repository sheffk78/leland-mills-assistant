/**
 * PUT    /api/permissions/[id] — Update a permission (requires admin)
 * DELETE /api/permissions/[id] — Delete a permission (requires admin)
 *
 * Cannot delete a permission if any role currently has it assigned.
 *
 * Note: In Next.js 16, `params` is a Promise and must be awaited.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
    key?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.permission.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Permission not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.name) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description || null;
  if (body.category !== undefined) updateData.category = body.category || null;

  // Allow key change only if not already referenced by role/user permissions
  if (body.key && body.key !== existing.key) {
    const lowerKey = body.key.toLowerCase();
    const usageCount = await prisma.rolePermission.count({
      where: { permissionKey: existing.key },
    });
    if (usageCount > 0) {
      return NextResponse.json(
        { error: "Cannot change the key of a permission that is already assigned to roles" },
        { status: 400 },
      );
    }
    const dup = await prisma.permission.findUnique({ where: { key: lowerKey } });
    if (dup) {
      return NextResponse.json(
        { error: `A permission with key "${lowerKey}" already exists` },
        { status: 409 },
      );
    }
    updateData.key = lowerKey;
  }

  const updated = await prisma.permission.update({
    where: { id },
    data: updateData,
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

  const existing = await prisma.permission.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Permission not found" }, { status: 404 });
  }

  // Check if any role has this permission assigned
  const roleCount = await prisma.rolePermission.count({
    where: { permissionKey: existing.key },
  });
  if (roleCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete permission "${existing.key}" — ${roleCount} role(s) still have it assigned. Remove those first.` },
      { status: 400 },
    );
  }

  await prisma.permission.delete({ where: { id } });

  return NextResponse.json({ success: true });
}