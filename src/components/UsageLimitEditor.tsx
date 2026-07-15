"use client";

/**
 * Client component for editing rate limits per role.
 *
 * Extracted from the Usage page (server component) because it needs
 * onClick handlers and DOM access for the save action.
 */

interface RoleOption {
  key: string;
  name: string;
}

interface UsageLimitEditorProps {
  roles: RoleOption[];
  limits: Record<string, { hourly: number; daily: number; monthly: number }>;
  defaultLimits: Record<string, { hourly: number; daily: number; monthly: number }>;
}

export function UsageLimitEditor({
  roles,
  limits,
  defaultLimits,
}: UsageLimitEditorProps) {
  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <div key={role.key} className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: "rgba(0,180,166,0.15)",
                color: "#00B4A6",
              }}
            >
              {role.name}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Hourly</label>
              <input
                type="number"
                min={1}
                defaultValue={limits[role.key]?.hourly ?? defaultLimits[role.key]?.hourly ?? 50}
                id={`limit-${role.key}-hourly`}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Daily</label>
              <input
                type="number"
                min={1}
                defaultValue={limits[role.key]?.daily ?? defaultLimits[role.key]?.daily ?? 200}
                id={`limit-${role.key}-daily`}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Monthly</label>
              <input
                type="number"
                min={1}
                defaultValue={limits[role.key]?.monthly ?? defaultLimits[role.key]?.monthly ?? 4000}
                id={`limit-${role.key}-monthly`}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
              />
            </div>
          </div>
          <button
            onClick={() => {
              const hourly = Number(
                (document.getElementById(`limit-${role.key}-hourly`) as HTMLInputElement)?.value,
              );
              const daily = Number(
                (document.getElementById(`limit-${role.key}-daily`) as HTMLInputElement)?.value,
              );
              const monthly = Number(
                (document.getElementById(`limit-${role.key}-monthly`) as HTMLInputElement)?.value,
              );

              fetch("/api/admin/usage/limits", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  role: role.key,
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
            style={{ backgroundColor: "var(--color-accent, #00B4A6)" }}
          >
            Save {role.name} Limits
          </button>
        </div>
      ))}
    </div>
  );
}