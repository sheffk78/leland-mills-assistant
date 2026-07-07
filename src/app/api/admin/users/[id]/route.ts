/**
 * Admin: Individual user management API.
 *
 * PUT    /api/admin/users/[id] — Update a user
 * DELETE /api/admin/users/[id] — Delete a user
 *
 * Admin-only access. Passwords and PIN codes are hashed with bcrypt
 * before storage.
 *
 * Note: In Next.js 16, `params` is a Promise and must be awaited.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import type { Role } from "@/generated/prisma/enums";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: {
    name?: string;
    email?: string;
    username?: string;
    password?: string;
    pinCode?: string;
    role?: Role;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Check user exists
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent self-deletion of admin role (safety)
  if (session.user.id === id && body.role && body.role !== "ADMIN") {
    return NextResponse.json(
      { error: "You cannot demote your own admin account" },
      { status: 400 },
    );
  }

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (body.name) updateData.name = body.name;
  if (body.role) updateData.role = body.role;

  // For non-DRIVER roles, update email
  if (body.role !== "DRIVER" && body.email) {
    // Check for duplicate email (excluding current user)
    const dup = await prisma.user.findFirst({
      where: { email: body.email, NOT: { id } },
    });
    if (dup) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }
    updateData.email = body.email;
  }

  // For non-DRIVER roles, update username
  if (body.role !== "DRIVER" && body.username !== undefined) {
    if (body.username) {
      // Check for duplicate username (excluding current user)
      const dup = await prisma.user.findFirst({
        where: { username: body.username, NOT: { id } },
      });
      if (dup) {
        return NextResponse.json(
          { error: "A user with this username already exists" },
          { status: 409 },
        );
      }
      updateData.username = body.username;
    } else {
      updateData.username = null;
    }
  }

  // If switching to DRIVER, clear email/password/username
  if (body.role === "DRIVER") {
    updateData.email = null;
    updateData.password = null;
    updateData.username = null;
  }

  // Hash and update password if provided
  if (body.password) {
    updateData.password = await bcrypt.hash(body.password, 10);
  }

  // Hash and update PIN if provided
  if (body.pinCode) {
    updateData.pinCode = await bcrypt.hash(body.pinCode, 10);
  }

  // If switching away from DRIVER, clear PIN
  if (body.role && body.role !== "DRIVER") {
    updateData.pinCode = null;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
      lastLogin: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent self-deletion
  if (session.user.id === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}