"use client";

/**
 * Client component for editing rate limits per role.
 *
 * Extracted from the Usage page (server component) because it needs
 * onClick handlers and DOM access for the save action.
 */

import type { Role } from "@/generated/prisma/enums";

interface UsageLimitEditorProps {
  roles: Role[];
  limits: Record<string, { hourly: number; daily: number; monthly: number }>;
  defaultLimits: Record<Role, { hourly: number; daily: number; monthly: number }>;
}

export function UsageLimitEditor({
  roles,
  limits,
  defaultLimits,
}: UsageLimitEditorProps) {
  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <div key={role} className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor:
                  role === "ADMIN"
                    ? "rgba(255,184,0,0.15)"
                    : role === "STAFF"
                      ? "rgba(59,130,246,0.15)"
                      : "rgba(16,185,129,0.15)",
                color:
                  role === "ADMIN"
                    ? "#FFB800"
                    : role === "STAFF"
                      ? "#3b82f6"
                      : "#10b981",
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
                defaultValue={limits[role]?.hourly ?? defaultLimits[role].hourly}
                id={`limit-${role}-hourly`}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Daily</label>
              <input
                type="number"
                min={1}
                defaultValue={limits[role]?.daily ?? defaultLimits[role].daily}
                id={`limit-${role}-daily`}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Monthly</label>
              <input
                type="number"
                min={1}
                defaultValue={limits[role]?.monthly ?? defaultLimits[role].monthly}
                id={`limit-${role}-monthly`}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
              />
            </div>
          </div>
          <button
            onClick={() => {
              const hourly = Number(
                (document.getElementById(`limit-${role}-hourly`) as HTMLInputElement)?.value,
              );
              const daily = Number(
                (document.getElementById(`limit-${role}-daily`) as HTMLInputElement)?.value,
              );
              const monthly = Number(
                (document.getElementById(`limit-${role}-monthly`) as HTMLInputElement)?.value,
              );

              fetch("/api/admin/usage/limits", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  role,
                  hourlyLimit: hourly,
                  dailyLimit: daily,
                  monthlyLimit: monthly,
                }),
              })
                .then((r) => r.json())
                .then((data) => {
                  if (data.message) {
                    alert(
                      `${data.message}: ${data.limits.hourly}/hr, ${data.limits.daily}/day, ${data.limits.monthly}/month`,
                    );
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
  );
}