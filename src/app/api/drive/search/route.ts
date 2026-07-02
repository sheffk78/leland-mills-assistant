/**
 * GET /api/drive/search?q=<query>
 *
 * Search for files in the Leland Mills Google Drive.
 * Returns matching files with metadata and view links.
 *
 * Requires authentication (any role). The Drive connection must be
 * configured by an admin via /api/admin/drive/connect first.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchDriveFiles } from "@/lib/drive-client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Search query too short (min 2 characters)" },
      { status: 400 },
    );
  }

  try {
    const results = await searchDriveFiles(query, 10);
    return NextResponse.json({ results, count: results.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Drive search failed";

    // Check if it's a configuration error (credentials not set up)
    if (msg.includes("credentials not configured")) {
      return NextResponse.json(
        {
          error: "Google Drive is not configured. An admin needs to connect it first.",
          results: [],
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Drive search failed", details: msg },
      { status: 500 },
    );
  }
}