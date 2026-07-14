/**
 * Admin: Usage & Rate Limits Dashboard
 *
 * Shows:
 * - Total messages (all time, this month, this week, today, last hour)
 * - Breakdown by role
 * - Breakdown by source (Hermes agent vs knowledge base)
 * - Top 10 users by message count
 * - Daily chart for the last 7 days
 * - Rate limit controls per role (adjustable)
 *
 * Admin-only. Server component that fetches stats and limits on render.
 */

import { getUsageStats, getLimitsForRole, DEFAULT_LIMITS } from "@/lib/rate-limiter";
import type { Role } from "@/generated/prisma/enums";
import { UsageLimitEditor } from "@/components/UsageLimitEditor";

// Force dynamic — always fresh data
export const dynamic = "force-dynamic";

export default async function AdminUsagePage() {
  let stats: Awaited<ReturnType<typeof getUsageStats>> | null = null;
  let statsError: string | null = null;

  try {
    stats = await getUsageStats();
  } catch (err) {
    statsError = err instanceof Error ? err.message : "Failed to load stats";
  }

  // Get current limits for all roles
  const roles: Role[] = ["ADMIN", "STAFF", "DRIVER"];
  const limits: Record<string, { hourly: number; daily: number; monthly: number }> = {};
  for (const role of roles) {
    try {
      limits[role] = await getLimitsForRole(role);
    } catch {
      limits[role] = DEFAULT_LIMITS[role];
    }
  }

  // Calculate estimated monthly cost (rough estimate)
  // Gemini 2.5 Pro via OpenRouter: ~$0.003-0.005 per message depending on context
  const COST_PER_MESSAGE = 0.004;
  const monthlyMessages = stats?.totalThisMonth ?? 0;
  const estMonthlyCost = (monthlyMessages * COST_PER_MESSAGE).toFixed(2);
  const knowledgeSavings = ((stats?.bySourceThisMonth.find((s) => s.source === "knowledge_base")?.count ?? 0) * COST_PER_MESSAGE).toFixed(2);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Usage &amp; Rate Limits</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Message volume, cost estimates, and adjustable rate limits per role
            </p>
          </div>
          {/* Export buttons */}
          <div className="flex gap-2">
            <a
              href="/api/export?type=usage"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Usage (CSV)
            </a>
            <a
              href="/api/export?type=conversations"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Conversations (CSV)
            </a>
          </div>
        </div>
      </div>

      {statsError && (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 mb-6">
          <p className="text-sm text-red-600 dark:text-red-400">
            Error loading stats: {statsError}
          </p>
        </div>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <StatCard label="All Time" value={stats?.totalAllTime ?? 0} />
        <StatCard label="This Month" value={stats?.totalThisMonth ?? 0} highlight />
        <StatCard label="This Week" value={stats?.totalThisWeek ?? 0} />
        <StatCard label="Today" value={stats?.totalToday ?? 0} />
        <StatCard label="Last Hour" value={stats?.totalLastHour ?? 0} />
      </div>

      {/* Cost estimate */}
      <div className="rounded-xl border border-border bg-surface p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Cost Estimate (This Month)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Estimated LLM Cost</p>
            <p className="text-2xl font-semibold text-foreground mt-1">${estMonthlyCost}</p>
            <p className="text-xs text-zinc-400 mt-1">~${COST_PER_MESSAGE}/message (Gemini 2.5 Pro)</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Knowledge Base Savings</p>
            <p className="text-2xl font-semibold text-green-600 dark:text-green-400 mt-1">${knowledgeSavings}</p>
            <p className="text-xs text-zinc-400 mt-1">Free answers served from cache</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Cache Hit Rate</p>
            <p className="text-2xl font-semibold text-foreground mt-1">
              {stats && stats.totalThisMonth > 0
                ? Math.round((stats.bySourceThisMonth.find((s) => s.source === "knowledge_base")?.count ?? 0) / stats.totalThisMonth * 100)
                : 0}%
            </p>
            <p className="text-xs text-zinc-400 mt-1">% of answers served without LLM</p>
          </div>
        </div>
      </div>

      {/* Breakdown by role */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Messages by Role (This Month)</h3>
          <div className="space-y-2">
            {roles.map((role) => {
              const count = stats?.byRoleThisMonth.find((r) => r.role === role)?.count ?? 0;
              const total = stats?.totalThisMonth ?? 1;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={role}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{role}</span>
                    <span className="text-zinc-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: role === "ADMIN" ? "#FFB800" : role === "STAFF" ? "#3b82f6" : "#10b981",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Source Breakdown (This Month)</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">Hermes Agent (LLM)</span>
              <span className="text-zinc-500">{stats?.bySourceThisMonth.find((s) => s.source === "hermes_agent")?.count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">Knowledge Base (Free)</span>
              <span className="text-zinc-500">{stats?.bySourceThisMonth.find((s) => s.source === "knowledge_base")?.count ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily chart */}
      {stats && stats.dailyBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Daily Messages (Last 7 Days)</h3>
          <div className="flex items-end gap-2 h-32">
            {stats.dailyBreakdown.map((day) => {
              const maxTotal = Math.max(...stats.dailyBreakdown.map((d) => d.total), 1);
              const heightPct = (day.total / maxTotal) * 100;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-zinc-500">{day.total}</span>
                  <div className="w-full flex flex-col justify-end" style={{ height: "80px" }}>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: "var(--color-accent, #FFB800)",
                        minHeight: day.total > 0 ? "4px" : "0",
                      }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400">{day.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top users */}
      {stats && stats.topUsersThisMonth.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Users (This Month)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-border">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium text-right">Messages</th>
              </tr>
            </thead>
            <tbody>
              {stats.topUsersThisMonth.map((user, i) => (
                <tr key={user.userId} className="border-b border-border/50">
                  <td className="py-2 text-zinc-400">{i + 1}</td>
                  <td className="py-2 text-foreground font-medium">{user.name}</td>
                  <td className="py-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: user.role === "ADMIN" ? "rgba(255,184,0,0.15)" : user.role === "STAFF" ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)",
                        color: user.role === "ADMIN" ? "#FFB800" : user.role === "STAFF" ? "#3b82f6" : "#10b981",
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="py-2 text-right text-foreground">{user.messageCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rate limit controls */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Rate Limits by Role</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Adjust how many messages each role can send per hour, day, and month.
          Knowledge base answers don&apos;t count against limits (they&apos;re free).
        </p>
        <UsageLimitEditor roles={roles} limits={limits} defaultLimits={DEFAULT_LIMITS} />
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-accent/30 bg-accent/5"
          : "border-border bg-surface"
      }`}
    >
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-2xl font-semibold text-foreground mt-1">{value.toLocaleString()}</p>
    </div>
  );
}