/**
 * Admin: User management API.
 *
 * GET  /api/admin/users — List all users
 * POST /api/admin/users — Create a new user
 *
 * Admin-only access. Passwords and PIN codes are hashed with bcrypt
 * before storage.
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

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
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

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const { name, email, username, password, pinCode, role } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!role || !["ADMIN", "STAFF", "DRIVER"].includes(role)) {
    return NextResponse.json({ error: "Valid role is required" }, { status: 400 });
  }

  // Validate required fields per role
  if (role !== "DRIVER") {
    // For ADMIN/STAFF, require at least an email OR a username, and a password
    if (!email && !username) {
      return NextResponse.json(
        { error: "Email or username is required for ADMIN/STAFF roles" },
        { status: 400 },
      );
    }
    if (!password) {
      return NextResponse.json(
        { error: "Password is required for ADMIN/STAFF roles" },
        { status: 400 },
      );
    }
  }

  if (role === "DRIVER" && !pinCode) {
    return NextResponse.json(
      { error: "PIN code is required for DRIVER role" },
      { status: 400 },
    );
  }

  // Check for duplicate email
  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }
  }

  // Check for duplicate username
  if (username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this username already exists" },
        { status: 409 },
      );
    }
  }

  // Hash credentials
  const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
  const hashedPin = pinCode ? await bcrypt.hash(pinCode, 10) : null;

  const user = await prisma.user.create({
    data: {
      name,
      email: role !== "DRIVER" ? (email || null) : null,
      username: role !== "DRIVER" ? (username || null) : null,
      password: hashedPassword,
      pinCode: hashedPin,
      role,
    },
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

  return NextResponse.json(user, { status: 201 });
}