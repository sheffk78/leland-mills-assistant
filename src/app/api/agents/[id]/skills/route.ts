/**
 * GET /api/agents/[id]/skills — List skills assigned to an agent's role (requires admin)
 *
 * Note: In Next.js 16, `params` is a Promise and must be awaited.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  const agent = await prisma.agentProfile.findUnique({
    where: { id },
    select: { id: true, profileKey: true, name: true, roleKey: true },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  // Find all SkillRoleAssignment rows for this agent's role, including the skill details
  const assignments = await prisma.skillRoleAssignment.findMany({
    where: { roleKey: agent.roleKey },
    include: {
      skill: {
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          category: true,
          isActive: true,
          isSystem: true,
          version: true,
        },
      },
    },
    orderBy: { skill: { name: "asc" } },
  });

  return NextResponse.json({
    agent: {
      id: agent.id,
      profileKey: agent.profileKey,
      name: agent.name,
      roleKey: agent.roleKey,
    },
    skills: assignments.map((a) => ({
      ...a.skill,
      isEnabled: a.isEnabled,
      assignedAt: a.assignedAt,
    })),
  });
}