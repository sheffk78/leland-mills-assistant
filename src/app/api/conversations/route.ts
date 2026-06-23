/**
 * GET  /api/conversations — List the current user's conversations
 * POST /api/conversations — Create a new conversation
 *
 * Requires authentication.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  return NextResponse.json(conversations);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: { title?: string } = {};
  try {
    body = await request.json();
  } catch {
    // body is optional — default to empty
  }

  const conversation = await prisma.conversation.create({
    data: {
      userId: session.user.id,
      title: body.title ?? "New Conversation",
    },
  });

  return NextResponse.json(conversation, { status: 201 });
}