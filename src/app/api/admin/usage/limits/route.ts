/**
 * GET  /api/admin/usage/limits     — Get all rate limits per role
 * PUT  /api/admin/usage/limits     — Update rate limits for a role
 *
 * Admin-only access.
 *
 * PUT body: { role: "DRIVER"|"STAFF"|"ADMIN", hourlyLimit: number, dailyLimit: number, monthlyLimit: number }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLimitsForRole, DEFAULT_LIMITS } from "@/lib/rate-limiter";
import type { Role } from "@/generated/prisma/enums";

const VALID_ROLES: Role[] = ["ADMIN", "STAFF", "DRIVER"];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Ensure all roles have limits rows
  const limits: Record<string, { hourly: number; daily: number; monthly: number }> = {};
  for (const role of VALID_ROLES) {
    limits[role] = await getLimitsForRole(role);
  }

  return NextResponse.json({ limits, defaults: DEFAULT_LIMITS });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { role?: string; hourlyLimit?: number; dailyLimit?: number; monthlyLimit?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { role, hourlyLimit, dailyLimit, monthlyLimit } = body;

  if (!role || !VALID_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "Invalid role. Must be ADMIN, STAFF, or DRIVER." }, { status: 400 });
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
  const existing = await prisma.usageLimit.findUnique({ where: { role: role as Role } });
  let updated;

  if (existing) {
    updated = await prisma.usageLimit.update({
      where: { role: role as Role },
      data: {
        hourlyLimit: h,
        dailyLimit: d,
        monthlyLimit: m,
      },
    });
  } else {
    updated = await prisma.usageLimit.create({
      data: {
        role: role as Role,
        hourlyLimit: h,
        dailyLimit: d,
        monthlyLimit: m,
      },
    });
  }

  return NextResponse.json({
    message: `Limits updated for ${role}`,
    limits: {
      role: updated.role,
      hourly: updated.hourlyLimit,
      daily: updated.dailyLimit,
      monthly: updated.monthlyLimit,
    },
  });
}