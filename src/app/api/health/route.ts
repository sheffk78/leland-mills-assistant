/**
 * GET /api/health
 *
 * Public health endpoint for monitoring. No auth required.
 * Returns 200 with JSON: { status, timestamp, uptime, db, bridge }
 *
 * DB check: runs a lightweight Prisma query (user count).
 * Bridge check: fetches localhost:8080/api/health.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Force dynamic — never cache a health check.
export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  // --- DB check ---
  let dbStatus: "connected" | "disconnected" = "disconnected";
  try {
    await prisma.user.count();
    dbStatus = "connected";
  } catch {
    // If the query fails the DB is unreachable
    dbStatus = "disconnected";
  }

  // --- Bridge check ---
  let bridgeStatus: "reachable" | "unreachable" = "unreachable";
  try {
    const bridgeUrl =
      process.env.BRIDGE_URL || "http://localhost:8080";
    const res = await fetch(`${bridgeUrl}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      bridgeStatus = "reachable";
    }
  } catch {
    // Bridge is down or unreachable
    bridgeStatus = "unreachable";
  }

  // Always return 200 so monitoring tools get a response body.
  // The `status` field and db/bridge fields tell the real story.
  const allHealthy = dbStatus === "connected" && bridgeStatus === "reachable";

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      timestamp,
      uptime,
      db: dbStatus,
      bridge: bridgeStatus,
    },
    { status: 200 },
  );
}