/**
 * GET /api/agents — List all agent profiles (requires admin)
 *
 * Returns AgentProfile records with related role info (looked up separately,
 * since AgentProfile.roleKey is a plain string, not a Prisma relation).
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

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

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

  return NextResponse.json(agentsWithRole);
}