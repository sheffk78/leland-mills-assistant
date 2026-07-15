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

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
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
    role?: string;
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

  // Validate role — must be an existing Role key
  if (!role) {
    return NextResponse.json({ error: "Valid role is required" }, { status: 400 });
  }

  const roleKey = role.toLowerCase();
  const roleRecord = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!roleRecord) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }

  // Validate required fields per role
  // Driver-type roles use PIN; other roles use email/username + password
  const isDriverType = roleKey === "driver";
  if (!isDriverType) {
    // For non-driver roles, require at least an email OR a username, and a password
    if (!email && !username) {
      return NextResponse.json(
        { error: "Email or username is required for this role" },
        { status: 400 },
      );
    }
    if (!password) {
      return NextResponse.json(
        { error: "Password is required for this role" },
        { status: 400 },
      );
    }
  }

  if (isDriverType && !pinCode) {
    return NextResponse.json(
      { error: "PIN code is required for driver role" },
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
      email: !isDriverType ? (email || null) : null,
      username: !isDriverType ? (username || null) : null,
      password: hashedPassword,
      pinCode: hashedPin,
      role: roleKey,
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