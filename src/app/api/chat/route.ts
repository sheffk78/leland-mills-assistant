/**
 * POST /api/chat
 *
 * Receives { message, conversationId? } and:
 *   1. Sends the message to the Hermes agent (or mock agent)
 *   2. Stores the user message and assistant response in the database
 *   3. Returns the assistant's response
 *
 * Requires authentication. The conversation is created automatically
 * if no conversationId is provided.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendChatMessage } from "@/lib/hermes-client";

export async function POST(request: Request) {
  // Authenticate the request
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
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

  // Send to Hermes agent and get response
  let assistantResponse: string;
  try {
    const result = await sendChatMessage({
      message,
      conversationId: conversation.id,
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

  return NextResponse.json({
    response: assistantResponse,
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    createdAt: new Date().toISOString(),
  });
}