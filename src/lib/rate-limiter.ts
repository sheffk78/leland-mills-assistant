/**
 * Rate limiting and usage tracking.
 *
 * Three tiers of limits per role:
 *   - Hourly: prevents burst abuse (e.g. 30 messages/hour for drivers)
 *   - Daily: caps total daily usage (e.g. 100 messages/day for drivers)
 *   - Monthly: prevents runaway costs (e.g. 2000 messages/month for drivers)
 *
 * Limits are stored in the database and adjustable by admins via the dashboard.
 * Every message is logged for stats and enforcement.
 *
 * Knowledge base hits don't count against limits (they're free — no LLM call).
 */

import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  /** How many messages the user has sent in the current window */
  usage: {
    hourly: number;
    daily: number;
    monthly: number;
  };
  /** The limits that apply to this user's role */
  limits: {
    hourly: number;
    daily: number;
    monthly: number;
  };
}

/**
 * Get the rate limits for a given role.
 * If no limits row exists for the role, create one with defaults.
 */
export async function getLimitsForRole(role: Role) {
  let limits = await prisma.usageLimit.findUnique({
    where: { role },
  });

  if (!limits) {
    try {
      limits = await prisma.usageLimit.create({
        data: {
          role,
          hourlyLimit: DEFAULT_LIMITS[role].hourly,
          dailyLimit: DEFAULT_LIMITS[role].daily,
          monthlyLimit: DEFAULT_LIMITS[role].monthly,
        },
      });
    } catch {
      // Race condition — another request created it. Fetch instead.
      limits = await prisma.usageLimit.findUnique({ where: { role } });
    }
  }

  if (!limits) {
    // Shouldn't happen, but return defaults as fallback
    return DEFAULT_LIMITS[role];
  }

  return {
    hourly: limits.hourlyLimit,
    daily: limits.dailyLimit,
    monthly: limits.monthlyLimit,
  };
}

/**
 * Default limits per role.
 * These are conservative starting points. Jake can adjust via dashboard.
 */
export const DEFAULT_LIMITS: Record<Role, { hourly: number; daily: number; monthly: number }> = {
  ADMIN: { hourly: 100, daily: 500, monthly: 10000 },
  STAFF: { hourly: 50, daily: 200, monthly: 4000 },
  DRIVER: { hourly: 30, daily: 100, monthly: 2000 },
};

/**
 * Check whether a user is within their rate limits.
 * Does NOT log the message — call logUsage() separately after the message is processed.
 *
 * @param userId - The user's UUID
 * @param role - The user's role
 * @returns RateLimitResult with allowed flag and usage/limits info
 */
export async function checkRateLimit(
  userId: string,
  role: Role,
): Promise<RateLimitResult> {
  const limits = await getLimitsForRole(role);
  const now = new Date();

  // Count messages in each window
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [hourly, daily, monthly] = await Promise.all([
    prisma.usageLog.count({
      where: { userId, source: "hermes_agent", createdAt: { gte: oneHourAgo } },
    }),
    prisma.usageLog.count({
      where: { userId, source: "hermes_agent", createdAt: { gte: oneDayAgo } },
    }),
    prisma.usageLog.count({
      where: { userId, source: "hermes_agent", createdAt: { gte: oneMonthAgo } },
    }),
  ]);

  const usage = { hourly, daily, monthly };

  // Check monthly first (most expensive limit to hit)
  if (monthly >= limits.monthly) {
    return {
      allowed: false,
      reason: `You've reached your monthly message limit (${limits.monthly} messages). This is a rolling 30-day window, so older messages will stop counting as they age out. Contact an administrator if you need more.`,
      usage,
      limits,
    };
  }

  // Check daily
  if (daily >= limits.daily) {
    return {
      allowed: false,
      reason: `You've reached your daily message limit (${limits.daily} messages). This is a rolling 24-hour window, so older messages will stop counting as they age out. Contact an administrator if you need more.`,
      usage,
      limits,
    };
  }

  // Check hourly
  if (hourly >= limits.hourly) {
    return {
      allowed: false,
      reason: `You're sending messages too quickly. You've used ${hourly} of your ${limits.hourly} hourly limit. Please wait a few minutes before trying again.`,
      usage,
      limits,
    };
  }

  return { allowed: true, usage, limits };
}

/**
 * Log a usage event. Called after a message is successfully processed.
 * Only logs LLM-backed messages (knowledge base hits are free and not logged).
 */
export async function logUsage(
  userId: string,
  role: Role,
  conversationId: string,
  source: "hermes_agent" | "knowledge_base" = "hermes_agent",
): Promise<void> {
  try {
    await prisma.usageLog.create({
      data: {
        userId,
        role,
        conversationId,
        source,
      },
    });
  } catch {
    // Silent failure — don't block the chat response on logging
  }
}

/**
 * Get aggregate usage stats for the admin dashboard.
 */
export async function getUsageStats() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalAllTime,
    totalLastHour,
    totalToday,
    totalThisWeek,
    totalThisMonth,
    byRoleThisMonth,
    bySourceThisMonth,
    topUsersThisMonth,
    dailyCounts,
  ] = await Promise.all([
    prisma.usageLog.count(),
    prisma.usageLog.count({ where: { createdAt: { gte: oneHourAgo } } }),
    prisma.usageLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.usageLog.count({ where: { createdAt: { gte: oneWeekAgo } } }),
    prisma.usageLog.count({ where: { createdAt: { gte: oneMonthAgo } } }),
    // By role this month
    prisma.usageLog.groupBy({
      by: ["role"],
      where: { createdAt: { gte: oneMonthAgo } },
      _count: true,
    }),
    // By source this month (hermes_agent vs knowledge_base)
    prisma.usageLog.groupBy({
      by: ["source"],
      where: { createdAt: { gte: oneMonthAgo } },
      _count: true,
    }),
    // Top 10 users this month
    prisma.usageLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: oneMonthAgo } },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 10,
    }),
    // Daily counts for the last 7 days (for chart data)
    prisma.usageLog.findMany({
      where: { createdAt: { gte: oneWeekAgo } },
      select: { createdAt: true, role: true, source: true },
    }),
  ]);

  // Get user names for top users
  const topUserIds = topUsersThisMonth.map((u) => u.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: topUserIds } },
    select: { id: true, name: true, role: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Aggregate daily counts into { date: { role: count, total: count } }
  const dailyMap = new Map<string, { date: string; total: number; DRIVER: number; STAFF: number; ADMIN: number }>();
  for (const log of dailyCounts) {
    const dateStr = log.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
    const entry = dailyMap.get(dateStr) ?? { date: dateStr, total: 0, DRIVER: 0, STAFF: 0, ADMIN: 0 };
    entry.total++;
    entry[log.role as "DRIVER" | "STAFF" | "ADMIN"]++;
    dailyMap.set(dateStr, entry);
  }
  const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalAllTime,
    totalLastHour,
    totalToday,
    totalThisWeek,
    totalThisMonth,
    byRoleThisMonth: byRoleThisMonth.map((r) => ({ role: r.role, count: r._count })),
    bySourceThisMonth: bySourceThisMonth.map((s) => ({ source: s.source, count: s._count })),
    topUsersThisMonth: topUsersThisMonth.map((u) => ({
      userId: u.userId,
      name: userMap.get(u.userId)?.name ?? "Unknown",
      role: userMap.get(u.userId)?.role ?? "STAFF",
      messageCount: u._count,
    })),
    dailyBreakdown,
  };
}

