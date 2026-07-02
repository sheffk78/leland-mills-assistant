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
        <h2 className="text-xl font-semibold text-foreground">Usage &amp; Rate Limits</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Message volume, cost estimates, and adjustable rate limits per role
        </p>
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

        <div className="space-y-4">
          {roles.map((role) => (
            <div key={role} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: role === "ADMIN" ? "rgba(255,184,0,0.15)" : role === "STAFF" ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)",
                    color: role === "ADMIN" ? "#FFB800" : role === "STAFF" ? "#3b82f6" : "#10b981",
                  }}
                >
                  {role}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Hourly</label>
                  <input
                    type="number"
                    min={1}
                    defaultValue={limits[role]?.hourly ?? DEFAULT_LIMITS[role].hourly}
                    id={`limit-${role}-hourly`}
                    className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Daily</label>
                  <input
                    type="number"
                    min={1}
                    defaultValue={limits[role]?.daily ?? DEFAULT_LIMITS[role].daily}
                    id={`limit-${role}-daily`}
                    className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Monthly</label>
                  <input
                    type="number"
                    min={1}
                    defaultValue={limits[role]?.monthly ?? DEFAULT_LIMITS[role].monthly}
                    id={`limit-${role}-monthly`}
                    className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  const hourly = Number((document.getElementById(`limit-${role}-hourly`) as HTMLInputElement)?.value);
                  const daily = Number((document.getElementById(`limit-${role}-daily`) as HTMLInputElement)?.value);
                  const monthly = Number((document.getElementById(`limit-${role}-monthly`) as HTMLInputElement)?.value);

                  fetch("/api/admin/usage/limits", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role, hourlyLimit: hourly, dailyLimit: daily, monthlyLimit: monthly }),
                  })
                    .then((r) => r.json())
                    .then((data) => {
                      if (data.message) {
                        alert(`${data.message}: ${data.limits.hourly}/hr, ${data.limits.daily}/day, ${data.limits.monthly}/month`);
                        window.location.reload();
                      } else {
                        alert(data.error || "Failed to update limits");
                      }
                    })
                    .catch(() => alert("Failed to update limits"));
                }}
                className="mt-3 text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--color-accent, #FFB800)", color: "#000000" }}
              >
                Save {role} Limits
              </button>
            </div>
          ))}
        </div>
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