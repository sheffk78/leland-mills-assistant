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
 * Bridge URL — the Next.js app and bridge both run on the same VPS.
 * The bridge listens on localhost:8080.
 */
const BRIDGE_URL = process.env.BRIDGE_URL ?? "http://localhost:8080";
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY ?? "REMOVED";

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

  // --- Create Hermes profile on the VPS via the bridge ---
  // This is a best-effort operation: if the bridge is unreachable, the DB
  // role is still created successfully — we just include a warning.
  let profileWarning: string | null = null;
  let agentProfile = null;

  try {
    const bridgeRes = await fetch(`${BRIDGE_URL}/api/profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": BRIDGE_API_KEY,
      },
      body: JSON.stringify({
        roleKey,
        name,
        description: description ?? "",
        systemPrompt: systemPrompt ?? "",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!bridgeRes.ok) {
      const errText = await bridgeRes.text().catch(() => "Unknown error");
      profileWarning = `Hermes profile creation failed: ${bridgeRes.status} ${errText}`;
    } else {
      const profileData = await bridgeRes.json();
      const profileKey = profileData.profileKey as string;

      // Create AgentProfile record in the DB
      agentProfile = await prisma.agentProfile.create({
        data: {
          profileKey,
          name: `${name} Agent`,
          description: description ?? null,
          roleKey,
          status: "active",
        },
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    profileWarning = `Hermes profile wasn't created: ${errMsg}`;
  }

  return NextResponse.json(
    {
      ...role,
      agentProfile,
      ...(profileWarning ? { warning: profileWarning } : {}),
    },
    { status: 201 },
  );
}