/**
 * POST /api/chat/agents — Agent management via chat (requires admin session)
 *
 * This route lets Archie (the Hermes agent) manage agent profiles programmatically
 * when Jake asks via chat. All actions require admin authentication.
 *
 * Actions:
 *   { action: "list" }
 *   { action: "update", agentId, model?, provider?, status? }
 *   { action: "health", agentId }
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
    case "update":
      return handleUpdate(body);
    case "health":
      return handleHealth(body);
    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );
  }
}

// --- Action handlers ---

async function handleList() {
  const agents = await prisma.agentProfile.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  // Batch-fetch the roles for all agent roleKeys
  const roleKeys = [...new Set(agents.map((a) => a.roleKey))];
  const roles = await prisma.role.findMany({
    where: { key: { in: roleKeys } },
    select: { key: true, name: true, isAdmin: true },
  });
  const roleMap = new Map(roles.map((r) => [r.key, r]));

  const agentsWithRole = agents.map((a) => ({
    ...a,
    role: roleMap.get(a.roleKey) ?? null,
  }));

  return NextResponse.json({
    success: true,
    action: "list",
    agents: agentsWithRole,
  });
}

async function handleUpdate(body: Record<string, unknown>) {
  const agentId = body.agentId as string | undefined;
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const model = body.model as string | undefined;
  const provider = body.provider as string | undefined;
  const status = body.status as string | undefined;

  const existing = await prisma.agentProfile.findUnique({ where: { id: agentId } });
  if (!existing) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (model !== undefined) updateData.model = model || null;
  if (provider !== undefined) updateData.provider = provider || null;

  if (status) {
    const validStatuses = ["active", "inactive", "error"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 },
      );
    }
    updateData.status = status;
  }

  const updated = await prisma.agentProfile.update({
    where: { id: agentId },
    data: updateData,
  });

  // Attach role info
  const role = await prisma.role.findUnique({
    where: { key: updated.roleKey },
    select: { key: true, name: true, isAdmin: true },
  });

  return NextResponse.json({
    success: true,
    action: "update",
    agent: { ...updated, role },
  });
}

async function handleHealth(body: Record<string, unknown>) {
  const agentId = body.agentId as string | undefined;
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const agent = await prisma.agentProfile.findUnique({ where: { id: agentId } });
  if (!agent) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  const startTime = Date.now();

  // Lightweight health check: verify the role exists and check status flags
  let status: "online" | "offline" = "online";
  let errorCount = 0;

  const role = await prisma.role.findUnique({
    where: { key: agent.roleKey },
    select: { key: true, name: true },
  });

  if (!role) {
    status = "offline";
    errorCount += 1;
  }

  if (agent.status === "error" || agent.status === "inactive") {
    status = "offline";
    if (agent.status === "error") errorCount += 1;
  }

  const responseTime = Date.now() - startTime;

  // Update lastHealthCheck timestamp
  await prisma.agentProfile.update({
    where: { id: agentId },
    data: { lastHealthCheck: new Date() },
  });

  return NextResponse.json({
    success: true,
    action: "health",
    agentId,
    profileKey: agent.profileKey,
    name: agent.name,
    status,
    responseTime,
    errorCount,
    checkedAt: new Date().toISOString(),
  });
}