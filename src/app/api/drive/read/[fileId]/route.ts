/**
 * GET /api/drive/read/:fileId
 *
 * Read the content of a specific Google Drive file.
 * For text-based files, returns extracted text content.
 * For binary files (PDFs, images), returns metadata with a view link.
 *
 * Requires authentication (any role).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readDriveFile } from "@/lib/drive-client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await params;

  if (!fileId) {
    return NextResponse.json(
      { error: "Missing fileId parameter" },
      { status: 400 },
    );
  }

  try {
    const file = await readDriveFile(fileId);
    return NextResponse.json(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to read file";

    if (msg.includes("credentials not configured")) {
      return NextResponse.json(
        { error: "Google Drive is not configured." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to read file", details: msg },
      { status: 500 },
    );
  }
}