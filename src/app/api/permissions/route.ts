/**
 * GET  /api/permissions — List all permissions (requires auth), grouped by category
 * POST /api/permissions — Create a new permission (requires admin)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await prisma.permission.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  // Return flat array — the permissions page expects Permission[]
  return NextResponse.json(permissions);
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
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { key, name, description, category } = body;

  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Permission key is required" }, { status: 400 });
  }
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Permission name is required" }, { status: 400 });
  }

  const lowerKey = key.toLowerCase();

  // Check for duplicate key
  const existing = await prisma.permission.findUnique({ where: { key: lowerKey } });
  if (existing) {
    return NextResponse.json(
      { error: `A permission with key "${lowerKey}" already exists` },
      { status: 409 },
    );
  }

  const permission = await prisma.permission.create({
    data: {
      key: lowerKey,
      name,
      description: description ?? null,
      category: category ?? null,
    },
  });

  return NextResponse.json(permission, { status: 201 });
}