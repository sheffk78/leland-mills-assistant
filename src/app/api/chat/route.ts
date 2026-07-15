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

/**
 * Generic fallback system prompt when a role has no custom systemPrompt in the DB.
 */
const GENERIC_PROMPT = `[Context: You are Archie, the AI assistant for Leland Mills. Help the user with their questions about company operations, tools, and resources.]`;

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

    // Prepend role context to the user's message so the Hermes agent
    // knows what tools and information are appropriate for this user
    const contextualizedMessage = `${roleContext}\n\nUser question: ${message}`;

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