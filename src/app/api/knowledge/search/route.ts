/**
 * GET /api/knowledge/search?q=<query>
 *
 * Search the auto-captured knowledge base for a matching Q&A pair.
 * Returns the best match or null if no good match found.
 *
 * Requires authentication (any role).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchKnowledge } from "@/lib/knowledge";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 3) {
    return NextResponse.json({ results: [], message: "Query too short" });
  }

  const match = await searchKnowledge(query);

  if (!match) {
    return NextResponse.json({ results: [], message: "No match found" });
  }

  return NextResponse.json({
    results: [match],
    message: "Match found",
  });
}