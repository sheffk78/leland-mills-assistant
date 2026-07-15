/**
 * GET  /api/admin/usage/limits     — Get all rate limits per role
 * PUT  /api/admin/usage/limits     — Update rate limits for a role
 *
 * Admin-only access.
 *
 * PUT body: { role: string, hourlyLimit: number, dailyLimit: number, monthlyLimit: number }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLimitsForRole, DEFAULT_LIMITS } from "@/lib/rate-limiter";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Get all roles from the Role table
  const roles = await prisma.role.findMany({
    select: { key: true, name: true },
    orderBy: { name: "asc" },
  });

  // Ensure all roles have limits rows
  const limits: Record<string, { hourly: number; daily: number; monthly: number }> = {};
  for (const role of roles) {
    limits[role.key] = await getLimitsForRole(role.key);
  }

  return NextResponse.json({ limits, defaults: DEFAULT_LIMITS, roles });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { role?: string; hourlyLimit?: number; dailyLimit?: number; monthlyLimit?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { role, hourlyLimit, dailyLimit, monthlyLimit } = body;

  if (!role) {
    return NextResponse.json({ error: "Role is required" }, { status: 400 });
  }

  const roleKey = role.toLowerCase();

  // Validate that the role exists in the Role table
  const roleRecord = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!roleRecord) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }

  // Validate limits are positive integers
  const h = Math.max(1, Math.floor(Number(hourlyLimit) || 0));
  const d = Math.max(1, Math.floor(Number(dailyLimit) || 0));
  const m = Math.max(1, Math.floor(Number(monthlyLimit) || 0));

  // Sanity check: daily should be >= hourly, monthly >= daily
  if (d < h) {
    return NextResponse.json({ error: "Daily limit should be >= hourly limit" }, { status: 400 });
  }
  if (m < d) {
    return NextResponse.json({ error: "Monthly limit should be >= daily limit" }, { status: 400 });
  }

  // Upsert the limits row — find first, then update or create
  const existing = await prisma.usageLimit.findUnique({ where: { role: roleKey } });
  let updated;

  if (existing) {
    updated = await prisma.usageLimit.update({
      where: { role: roleKey },
      data: {
        hourlyLimit: h,
        dailyLimit: d,
        monthlyLimit: m,
      },
    });
  } else {
    updated = await prisma.usageLimit.create({
      data: {
        role: roleKey,
        hourlyLimit: h,
        dailyLimit: d,
        monthlyLimit: m,
      },
    });
  }

  return NextResponse.json({
    message: `Limits updated for ${roleRecord.name}`,
    limits: {
      role: updated.role,
      hourly: updated.hourlyLimit,
      daily: updated.dailyLimit,
      monthly: updated.monthlyLimit,
    },
  });
}