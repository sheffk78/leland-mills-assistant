/**
 * GET /api/files — List file attachments (requires auth)
 *
 * Admin users see all file attachments across all conversations.
 * Non-admin users see only files from their own conversations.
 *
 * Returns: id, filename, filepath, mimetype, filesize, createdAt,
 *          messageId, conversationId
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.isAdmin ?? false;

  // Admin gets all files; non-admin gets only files from their own conversations
  const where = isAdmin
    ? {}
    : {
        message: {
          conversation: {
            userId: session.user.id,
          },
        },
      };

  const files = await prisma.fileAttachment.findMany({
    where,
    select: {
      id: true,
      filename: true,
      filepath: true,
      mimetype: true,
      filesize: true,
      createdAt: true,
      messageId: true,
      message: {
        select: {
          conversationId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Flatten conversationId to top level for cleaner API response
  const result = files.map((f) => ({
    id: f.id,
    filename: f.filename,
    filepath: f.filepath,
    mimetype: f.mimetype,
    filesize: f.filesize,
    createdAt: f.createdAt,
    messageId: f.messageId,
    conversationId: f.message.conversationId,
  }));

  return NextResponse.json({
    success: true,
    files: result,
    count: result.length,
  });
}