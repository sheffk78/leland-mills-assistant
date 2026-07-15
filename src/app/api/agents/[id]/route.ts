/**
 * GET /api/agents/[id] — Get a single agent profile with details (requires admin)
 * PUT /api/agents/[id] — Update an agent profile (requires admin)
 *
 * Note: In Next.js 16, `params` is a Promise and must be awaited.
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  const agent = await prisma.agentProfile.findUnique({ where: { id } });

  if (!agent) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  // Fetch the role separately (AgentProfile.roleKey is a plain string, not a relation)
  const role = await prisma.role.findUnique({
    where: { key: agent.roleKey },
    select: { key: true, name: true, isAdmin: true, description: true },
  });

  return NextResponse.json({ ...agent, role });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  let body: {
    name?: string;
    description?: string;
    model?: string;
    provider?: string;
    status?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.agentProfile.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.name) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description || null;
  if (body.model !== undefined) updateData.model = body.model || null;
  if (body.provider !== undefined) updateData.provider = body.provider || null;

  if (body.status) {
    const validStatuses = ["active", "inactive", "error"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 },
      );
    }
    updateData.status = body.status;
  }

  const updated = await prisma.agentProfile.update({
    where: { id },
    data: updateData,
  });

  // Attach role info for the response
  const role = await prisma.role.findUnique({
    where: { key: updated.roleKey },
    select: { key: true, name: true, isAdmin: true },
  });

  return NextResponse.json({ ...updated, role });
}