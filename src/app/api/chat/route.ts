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
import { searchKnowledge, captureKnowledge } from "@/lib/knowledge";
import { checkRateLimit, logUsage } from "@/lib/rate-limiter";

/**
 * Build a role-based system prompt for the Hermes agent.
 * This tells the agent what tools/capabilities the user has access to
 * based on their role in the company.
 */
function getRoleContext(role: string, name: string): string {
  const roleContexts: Record<string, string> = {
    DRIVER: `[Context: The user ${name} is a DRIVER. Focus on: pre-trip inspections, delivery instructions, DOT hours of service, route information, delivery notes, vehicle defects. Do not provide information about sales leads, financial data, HR matters, or admin functions unless directly safety-relevant.]`,
    STAFF: `[Context: The user ${name} is WAREHOUSE STAFF. Focus on: inventory management, feed types and storage, maintenance scheduling, delivery coordination, safety procedures, equipment operation. You can also help with basic sales lookups and customer delivery instructions.]`,
    ADMIN: `[Context: The user ${name} is an ADMINISTRATOR with full access. You can help with: all operational tools, sales pipeline, financial summaries, HR policies, compliance, fleet management, strategic questions, and anything else related to running the business.]`,
  };

  return roleContexts[role] ?? roleContexts.STAFF;
}

export async function POST(request: Request) {
  // Authenticate the request
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { message?: string; conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { message, conversationId } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'message' field" },
      { status: 400 },
    );
  }

  // RATE LIMIT CHECK — verify user is within their limits before processing
  const userRole = (session.user.role ?? "STAFF") as "ADMIN" | "STAFF" | "DRIVER";
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

  // STEP 1: Check the knowledge base for an instant answer
  const knowledgeMatch = await searchKnowledge(message);

  if (knowledgeMatch) {
    const knowledgeResponse = knowledgeMatch.answer;

    // Store the assistant response (tagged as from knowledge base)
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: knowledgeResponse,
      },
    });

    // Auto-capture is skipped since we served from knowledge base (already captured)

    // Log usage (knowledge base hits are tracked for stats but don't count against rate limits)
    logUsage(session.user.id, userRole, conversation.id, "knowledge_base").catch(() => {});

    return NextResponse.json({
      response: knowledgeResponse,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      source: "knowledge_base",
      knowledgeEntryId: knowledgeMatch.id,
      createdAt: new Date().toISOString(),
    });
  }

  // STEP 2: No knowledge base match — send to Hermes agent
  let assistantResponse: string;
  try {
    // Fetch recent conversation history for context
    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: { role: true, content: true },
    });

    // Build the prompt with role-based context
    const roleContext = getRoleContext(
      session.user.role ?? "STAFF",
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

  // STEP 3: Auto-capture this Q&A pair into the knowledge base
  // This is fire-and-forget — don't block the response on it
  captureKnowledge(message, assistantResponse, session.user.id).catch(() => {
    // Silent failure — knowledge capture is best-effort
  });

  // Log usage (this counts against rate limits — it was an LLM call)
  logUsage(session.user.id, userRole, conversation.id, "hermes_agent").catch(() => {});

  return NextResponse.json({
    response: assistantResponse,
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    source: "hermes_agent",
    createdAt: new Date().toISOString(),
  });
}