/**
 * GET /api/files/[id]/download
 *
 * Downloads a file attachment by its ID.
 * Looks up the file_attachment in the database, reads the file from disk,
 * and returns it with appropriate headers for download.
 *
 * Requires authentication (any role).
 *
 * In Next.js 16, `params` is a Promise and must be awaited.
 */

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  // Look up the file attachment in the database
  const attachment = await prisma.fileAttachment.findUnique({
    where: { id },
    include: { message: { select: { conversation: { select: { userId: true } } } } },
  });

  if (!attachment) {
    return NextResponse.json(
      { error: "File not found" },
      { status: 404 },
    );
  }

  // Non-admin users can only download files from their own conversations
  if (!session.user.isAdmin && attachment.message?.conversation?.userId !== session.user.id) {
    return NextResponse.json(
      { error: "You do not have access to this file" },
      { status: 403 },
    );
  }

  // Resolve the file path on disk
  // filepath is stored as a URL path like /uploads/{filename}
  const filename = basename(attachment.filepath);
  const filePath = join(process.cwd(), "public", "uploads", filename);

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(filePath);
  } catch {
    return NextResponse.json(
      { error: "File not found on disk" },
      { status: 404 },
    );
  }

  // Return the file with download headers
  // Convert Buffer to a ReadableStream for the Response body
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new Uint8Array(
          fileBuffer.buffer.slice(
            fileBuffer.byteOffset,
            fileBuffer.byteOffset + fileBuffer.byteLength,
          ) as ArrayBuffer,
        ),
      );
      controller.close();
    },
  });
  const headers = new Headers();
  headers.set(
    "Content-Disposition",
    `attachment; filename="${attachment.filename}"`,
  );
  headers.set("Content-Type", attachment.mimetype);
  headers.set("Content-Length", String(attachment.filesize));

  return new Response(stream, { status: 200, headers });
}