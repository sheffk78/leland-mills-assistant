/**
 * GET /api/admin/usage/stats
 *
 * Returns aggregate usage statistics for the admin dashboard.
 * Admin-only access.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUsageStats } from "@/lib/rate-limiter";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const stats = await getUsageStats();
    return NextResponse.json(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get stats";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}