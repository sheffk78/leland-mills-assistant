/**
 * PUT    /api/roles/[id]   — Update a role (requires admin)
 * DELETE /api/roles/[id]   — Delete a role (requires admin, cannot delete system roles)
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
    key?: string;
    description?: string;
    systemPrompt?: string;
    isAdmin?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.name) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description || null;
  if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt || null;
  if (body.isAdmin !== undefined) updateData.isAdmin = body.isAdmin;

  // System roles cannot have their key changed (it would break references)
  if (body.key && body.key !== existing.key) {
    if (existing.isSystem) {
      return NextResponse.json(
        { error: "Cannot change the key of a system role" },
        { status: 400 },
      );
    }
    const lowerKey = body.key.toLowerCase();
    const dup = await prisma.role.findUnique({ where: { key: lowerKey } });
    if (dup && dup.id !== id) {
      return NextResponse.json(
        { error: `A role with key "${lowerKey}" already exists` },
        { status: 409 },
      );
    }
    updateData.key = lowerKey;
  }

  const updated = await prisma.role.update({
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

  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  // System roles cannot be deleted
  if (existing.isSystem) {
    return NextResponse.json(
      { error: `Cannot delete system role "${existing.name}"` },
      { status: 400 },
    );
  }

  // Check if any users are still using this role
  const userCount = await prisma.user.count({ where: { role: existing.key } });
  if (userCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete role "${existing.name}" — ${userCount} user(s) still have this role. Reassign them first.` },
      { status: 400 },
    );
  }

  // Also clean up any usage limits for this role
  await prisma.usageLimit.deleteMany({ where: { role: existing.key } }).catch(() => {});

  await prisma.role.delete({ where: { id } });

  return NextResponse.json({ success: true });
}