/**
 * POST /api/skills/[id]/test — Test a skill by sending a message to the bridge
 * with the skill content prepended to the system prompt.
 *
 * Body: { message, history? }
 * Returns: { response }
 *
 * Requires admin session.
 *
 * Note: In Next.js 16, `params` is a Promise and must be awaited.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { bridgePost } from "@/lib/bridge-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  let body: { message?: string; history?: Array<{ role: string; content: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, history } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'message' field" },
      { status: 400 },
    );
  }

  // Read the skill from the DB to get its content
  const skill = await prisma.skill.findUnique({
    where: { id },
    select: {
      name: true,
      description: true,
      content: true,
      key: true,
    },
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  // Build the system prompt with skill content prepended
  const skillContent = skill.content ?? `(No SKILL.md content for ${skill.name})`;
  const systemPrompt = [
    `You are being tested in a skill sandbox. The following skill is loaded:`,
    ``,
    `## Skill: ${skill.name}`,
    skill.description ? `Description: ${skill.description}` : ``,
    ``,
    `### SKILL.md Content`,
    `${skillContent}`,
    ``,
    `---`,
    `Follow the skill instructions above when responding to the user's message.`,
    `This is a test session — respond as if the skill is active in your system.`,
  ].join("\n");

  // Send to the bridge with skill content prepended to the system prompt
  try {
    const result = await bridgePost<{ response?: string; message?: string; error?: string }>(
      "/api/chat",
      {
        message: `${systemPrompt}\n\nUser question: ${message}`,
        history: history ?? [],
        role: "admin",
      },
    );

    const responseText =
      result.response ??
      result.message ??
      (typeof result === "string" ? result : "No response from bridge");

    return NextResponse.json({ response: responseText });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Bridge communication failed";
    return NextResponse.json(
      { error: errMsg },
      { status: 502 },
    );
  }
}