/**
 * GET  /api/roles     — List all roles (requires auth)
 * POST /api/roles     — Create a new role (requires admin)
 *
 * This is the API that Archie calls when Jake says "add a Manager role".
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Generate a URL-safe slug key from a display name.
 * E.g. "Manager" → "manager", "Shift Supervisor" → "shift-supervisor"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(roles);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

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

  const { name, key, description, systemPrompt, isAdmin } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Generate key from name if not provided
  const roleKey = (key ?? slugify(name)).toLowerCase();

  if (!roleKey) {
    return NextResponse.json({ error: "Could not generate a valid role key" }, { status: 400 });
  }

  // Check for duplicate key
  const existing = await prisma.role.findUnique({ where: { key: roleKey } });
  if (existing) {
    return NextResponse.json(
      { error: `A role with key "${roleKey}" already exists` },
      { status: 409 },
    );
  }

  const role = await prisma.role.create({
    data: {
      key: roleKey,
      name,
      description: description ?? null,
      systemPrompt: systemPrompt ?? null,
      isAdmin: isAdmin ?? false,
      isSystem: false, // User-created roles are never system roles
    },
  });

  return NextResponse.json(role, { status: 201 });
}