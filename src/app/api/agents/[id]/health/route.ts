/**
 * POST /api/agents/[id]/health — Run a health check on an agent (requires admin)
 *
 * Returns: { status: "online"|"offline", responseTime: ms, errorCount: N }
 *
 * The health check is a lightweight DB-based check: we verify the agent profile
 * exists, its role is valid, and update lastHealthCheck. A real production
 * implementation would ping the Hermes profile endpoint — but since we have no
 * external agent runtime wired up here, we treat a valid DB record as "online".
 *
 * Note: In Next.js 16, `params` is a Promise and must be awaited.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  const agent = await prisma.agentProfile.findUnique({ where: { id } });

  if (!agent) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  const startTime = Date.now();

  // Lightweight health check: verify the role referenced by this agent still exists.
  // In a full implementation this would ping the Hermes profile's API endpoint.
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
    // An agent explicitly marked inactive/error is reported as offline
    status = "offline";
    if (agent.status === "error") errorCount += 1;
  }

  const responseTime = Date.now() - startTime;

  // Update lastHealthCheck timestamp
  await prisma.agentProfile.update({
    where: { id },
    data: { lastHealthCheck: new Date() },
  });

  return NextResponse.json({
    agentId: id,
    profileKey: agent.profileKey,
    name: agent.name,
    status,
    responseTime,
    errorCount,
    checkedAt: new Date().toISOString(),
  });
}