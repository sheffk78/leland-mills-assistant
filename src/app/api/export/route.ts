/**
 * GET /api/export
 *
 * Exports usage or conversation data as a CSV file download.
 *
 * Query params:
 *   - type: "usage" | "conversations" (required)
 *   - from: ISO date string (optional, inclusive lower bound)
 *   - to:   ISO date string (optional, inclusive upper bound)
 *
 * Requires ADMIN role.
 *
 * CSV is built manually (no external library) to keep dependencies minimal.
 * Fields with commas, quotes, or newlines are properly escaped per RFC 4180.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Escape a value for CSV per RFC 4180. */
function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Convert an array of objects to CSV text. */
function toCSV(headers: string[], rows: (string | null | undefined)[][]): string {
  const headerLine = headers.map(csvEscape).join(",");
  const dataLines = rows.map((row) => row.map(csvEscape).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function GET(request: Request) {
  // Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin-only
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
  }

  // Parse query params
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!type || (type !== "usage" && type !== "conversations")) {
    return NextResponse.json(
      { error: "Missing or invalid 'type' param. Must be 'usage' or 'conversations'." },
      { status: 400 },
    );
  }

  // Build date filter
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) dateFilter.gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime())) dateFilter.lte = toDate;
  }

  const whereClause =
    Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

  let csvContent: string;
  let filename: string;

  if (type === "usage") {
    // Export UsageLog data
    const logs = await prisma.usageLog.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      select: {
        userId: true,
        role: true,
        conversationId: true,
        source: true,
        createdAt: true,
      },
    });

    const headers = ["userId", "role", "conversationId", "source", "timestamp"];
    const rows = logs.map((log) => [
      log.userId,
      log.role,
      log.conversationId,
      log.source,
      log.createdAt.toISOString(),
    ]);

    csvContent = toCSV(headers, rows);
    filename = `usage-export-${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    // Export Conversation + Message data
    const messages = await prisma.message.findMany({
      where: {
        conversation: {
          ...(Object.keys(dateFilter).length > 0
            ? { createdAt: dateFilter }
            : {}),
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        conversation: {
          select: {
            id: true,
            userId: true,
            title: true,
          },
        },
      },
    });

    const headers = [
      "messageId",
      "conversationId",
      "userId",
      "conversationTitle",
      "role",
      "messageContent",
      "timestamp",
    ];
    const rows = messages.map((msg) => [
      msg.id,
      msg.conversation.id,
      msg.conversation.userId,
      msg.conversation.title ?? "",
      msg.role,
      msg.content,
      msg.createdAt.toISOString(),
    ]);

    csvContent = toCSV(headers, rows);
    filename = `conversations-export-${new Date().toISOString().slice(0, 10)}.csv`;
  }

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}