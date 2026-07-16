/**
 * POST /api/chat
 *
 * Receives { message, conversationId? } and:
 *   1. Checks the knowledge base for a matching Q&A pair (instant answer)
 *   2. If no match, sends the message to the Hermes agent (or mock agent)
 *   3. Stores the user message and assistant response in the database
 *   4. Auto-captures useful Q&A pairs into the knowledge base
 *   5. Returns the assistant's response
 *
 * Requires authentication. The conversation is created automatically
 * if no conversationId is provided.
 *
 * Role-based context: The user's role is passed to the Hermes agent
 * so it can tailor responses (drivers see driver tools, staff see staff tools, etc.)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendChatMessage } from "@/lib/hermes-client";
import { checkRateLimit, logUsage } from "@/lib/rate-limiter";
import { getUserPermissions } from "@/lib/permissions";

/**
 * Generic fallback system prompt when a role has no custom systemPrompt in the DB.
 */
const GENERIC_PROMPT = `[Context: You are Archie, the AI assistant for Leland Mills. Help the user with their questions about company operations, tools, and resources.]`;

/**
 * All known permission keys in the system. Used to compute the "cannot" set
 * (all known permissions minus what the user is allowed to do).
 */
async function getAllPermissionKeys(): Promise<Set<string>> {
  const perms = await prisma.permission.findMany({ select: { key: true } });
  return new Set(perms.map((p) => p.key));
}

/**
 * Build a role-based system prompt for the Hermes agent.
 * Looks up the Role by key from the database and uses its systemPrompt.
 * Falls back to a generic prompt if the role has no custom prompt.
 */
async function getRolePrompt(roleKey: string, userName: string): Promise<string> {
  const role = await prisma.role.findUnique({
    where: { key: roleKey.toLowerCase() },
    select: { systemPrompt: true, name: true },
  });

  if (role?.systemPrompt) {
    return role.systemPrompt.replace(/\{name\}/g, userName);
  }

  return GENERIC_PROMPT;
}

/**
 * Build a permissions context block for the system prompt.
 *
 * For admins: states they have full permissions and can manage the system.
 * For everyone else: lists what they can and cannot do, and adds guidance
 * on how to handle permission-denied situations and cross-agent handoff.
 */
async function buildPermissionsContext(
  userId: string,
  isAdmin: boolean,
  roleKey: string,
  roleName: string,
): Promise<string> {
  if (isAdmin) {
    return [
      `PERMISSIONS: You are an admin user (${roleName}, key: ${roleKey}) with full permissions. You can manage roles, permissions, skills, and agents.`,
      ``,
      `MANAGEMENT INSTRUCTIONS: You are Archie, the Leland Mills assistant. The admin user (Jake) can manage the system through you. When Jake asks you to:`,
      `- Add a new skill: Use the skill management tools (POST /api/chat/skills with action "create"). Create a skill with a clear name, description, category, and SKILL.md content. Assign it to the appropriate roles via roleKeys.`,
      `- Update a skill: Use POST /api/chat/skills with action "update", passing the skillId and new content. A new version is created automatically.`,
      `- Assign/unassign a skill to a role: Use POST /api/chat/skills with action "assign" or "unassign", passing skillId and roleKey.`,
      `- Enable/disable a skill: Use POST /api/chat/skills with action "toggle", passing skillId and isActive (boolean).`,
      `- List skills: Use POST /api/chat/skills with action "list" to see all skills and their role assignments.`,
      `- Change permissions: Use the permission management tools (POST /api/chat/permissions). When Jake says "let managers write to employee files but not see pay rates", assign employee_files:write with effect "allow" and pay_rates:read with effect "deny" to the manager role.`,
      `- List permissions: Use POST /api/chat/permissions with action "list" to see all permissions and role assignments.`,
      `- Set all permissions for a role: Use POST /api/chat/permissions with action "set_role", passing roleKey and the full permissions array.`,
      `- Remove a permission from a role: Use POST /api/chat/permissions with action "remove", passing roleKey and permissionKey.`,
      `- Check agent status: Use the agent management tools (POST /api/chat/agents). List agents with action "list", update an agent with action "update", or run a health check with action "health".`,
      `- Create a new role: Create the role via /api/roles, then set up permissions via the permission tools (POST /api/chat/permissions action "set_role"), then suggest creating a Hermes profile for the new role.`,
      ``,
      `Always confirm what you did after making changes. Be specific: "I've added the Fuel Log Lookup skill and enabled it for drivers and managers."`,
      ``,
      `CROSS-AGENT AWARENESS: You can check what other agents know. If a question is better suited for another role's agent, suggest: "This might be better answered by the [role] agent. Would you like me to check?" and if confirmed, note it for follow-up.`,
    ].join("\n");
  }

  // Non-admin: resolve effective permissions and compute the "cannot" set
  const allowed = await getUserPermissions(userId);
  const allKeys = await getAllPermissionKeys();
  const denied = [...allKeys].filter((k) => !allowed.has(k));

  const allowedStr = allowed.size > 0 ? [...allowed].sort().join(", ") : "(none)";
  const deniedStr = denied.length > 0 ? denied.sort().join(", ") : "(none)";

  return [
    `PERMISSIONS: The user's role is ${roleName} (key: ${roleKey}).`,
    `You can: ${allowedStr}.`,
    `You cannot: ${deniedStr}.`,
    ``,
    `If the user asks to do something they don't have permission for, politely explain what permissions they need and suggest they ask an admin.`,
    ``,
    `CROSS-AGENT HANDOFF: If a user asks something outside their role's scope, don't just say no. Suggest checking with the admin: "That's outside my scope for ${roleName}. Would you like me to check with the admin team on that?" If they confirm, note that the admin will follow up.`,
  ].join("\n");
}

export async function POST(request: Request) {
  // Authenticate the request
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    message?: string;
    conversationId?: string;
    attachments?: { id: string; filename: string; url: string; mimetype: string; filesize: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { message, conversationId, attachments } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'message' field" },
      { status: 400 },
    );
  }

  // RATE LIMIT CHECK — verify user is within their limits before processing
  const userRole = (session.user.role ?? "staff") as string;
  const rateCheck = await checkRateLimit(session.user.id, userRole);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: rateCheck.reason,
        usage: rateCheck.usage,
        limits: rateCheck.limits,
      },
      { status: 429 },
    );
  }

  // Find or create the conversation
  let conversation;
  if (conversationId) {
    // Verify the conversation belongs to this user
    conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }
  } else {
    // Create a new conversation — use first ~50 chars of message as title
    const title = message.length > 50 ? message.slice(0, 50) + "..." : message;
    conversation = await prisma.conversation.create({
      data: {
        userId: session.user.id,
        title,
      },
    });
  }

  // Store the user message
  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: message,
    },
  });

  // Link any uploaded attachments to this message
  let userAttachments: { id: string; filename: string; url: string; mimetype: string; filesize: number }[] = [];
  if (attachments && Array.isArray(attachments) && attachments.length > 0) {
    try {
      await prisma.fileAttachment.createMany({
        data: attachments.map((att) => ({
          id: att.id,
          messageId: userMessage.id,
          filename: att.filename,
          filepath: att.url,
          mimetype: att.mimetype,
          filesize: att.filesize,
        })),
      });
      // Only return attachments that were successfully created
      userAttachments = attachments;
    } catch {
      // Non-fatal — attachments are optional metadata
    }
  }

  // NOTE: Knowledge base interception DISABLED (2026-07-07).
  // The auto-capture + global search was causing cross-conversation pollution:
  // answers from one conversation thread were being served in response to
  // questions in a completely different thread, because the ILIKE search
  // with a 40% word-overlap threshold was too loose. This caused Jake to get
  // stuck in loops where stale answers from previous conversations kept
  // recurring. Re-enable only with per-conversation scoping or a much higher
  // similarity threshold (70%+).

  // STEP 1: Send all messages to Hermes agent
  let assistantResponse: string;
  try {
    // Fetch recent conversation history for context
    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: { role: true, content: true },
    });

    // Build the prompt with role-based context from the DB
    const roleContext = await getRolePrompt(
      session.user.role ?? "staff",
      session.user.name ?? "User",
    );

    // Build permissions context (admin: management instructions; non-admin:
    // permission list + cross-agent handoff guidance)
    const permissionsContext = await buildPermissionsContext(
      session.user.id,
      session.user.isAdmin ?? false,
      session.user.role ?? "staff",
      session.user.roleName ?? "Staff",
    );

    // Prepend role context + permissions context to the user's message so
    // the Hermes agent knows what tools and information are appropriate
    const contextualizedMessage = `${roleContext}\n\n${permissionsContext}\n\nUser question: ${message}`;

    const result = await sendChatMessage({
      message: contextualizedMessage,
      conversationId: conversation.id,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      role: userRole,
    });
    assistantResponse = result.response;
  } catch (err) {
    // If the agent is unreachable, store an error message but don't crash
    const errMsg =
      err instanceof Error ? err.message : "Unknown agent error";

    // Store a system message about the failure
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "SYSTEM",
        content: `Agent communication failed: ${errMsg}`,
      },
    });

    return NextResponse.json(
      {
        error: "The assistant is currently unavailable. Please try again later.",
        details: errMsg,
        conversationId: conversation.id,
      },
      { status: 502 },
    );
  }

  // Store the assistant response
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: assistantResponse,
    },
  });

  // STEP 2: Auto-capture DISABLED (2026-07-07).
  // Knowledge base auto-capture was polluting the global search table with
  // every Q&A pair from every conversation, which then got served back as
  // "instant answers" in unrelated conversations. Disabled alongside the
  // knowledge base search above. Re-enable together with proper scoping.
  // captureKnowledge(message, assistantResponse, session.user.id).catch(() => {});

  // Log usage (this counts against rate limits — it was an LLM call)
  logUsage(session.user.id, userRole, conversation.id, "hermes_agent").catch(() => {});

  return NextResponse.json({
    response: assistantResponse,
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    source: "hermes_agent",
    createdAt: new Date().toISOString(),
    attachments: userAttachments,
  });
}