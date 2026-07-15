/**
 * Admin: Agent Management page.
 *
 * - Grid of agent cards, one per Hermes profile
 * - Each card: name, role, status indicator (green/red/yellow), model,
 *   last health check, Check Health button, Edit button, skills count badge
 * - "Create Agent" button
 * - Auto-refresh status every 30 seconds
 *
 * Styled with the existing design system: teal #00B4A6 accent.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Agent {
  id: string;
  profileKey: string;
  name: string;
  description: string | null;
  roleKey: string;
  status: string; // "online" | "offline" | "checking"
  model: string;
  provider: string | null;
  lastHealthCheck: string | null;
  skillsCount?: number;
}

const STATUS_CONFIG: Record<
  string,
  { color: string; label: string; dotClass: string }
> = {
  online: {
    color: "#22c55e",
    label: "Online",
    dotClass: "bg-green-500",
  },
  offline: {
    color: "#ef4444",
    label: "Offline",
    dotClass: "bg-red-500",
  },
  checking: {
    color: "#eab308",
    label: "Checking...",
    dotClass: "bg-yellow-500",
  },
};

function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status] ?? {
      color: "#71717a",
      label: status || "Unknown",
      dotClass: "bg-zinc-500",
    }
  );
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [healthCheckingIds, setHealthCheckingIds] = useState<Set<string>>(
    new Set(),
  );

  // Edit/Create form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formProvider, setFormProvider] = useState("");
  const [formRoleKey, setFormRoleKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load agents");
      setAgents(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Auto-refresh every 30 seconds
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchAgents();
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAgents]);

  // Check health for a single agent
  const handleCheckHealth = async (agent: Agent) => {
    setHealthCheckingIds((prev) => new Set(prev).add(agent.id));
    // Optimistically set status to "checking"
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agent.id ? { ...a, status: "checking" } : a,
      ),
    );
    try {
      const res = await fetch(`/api/agents/${agent.id}/health`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Health check failed" }));
        throw new Error(data.error || "Health check failed");
      }
      const data = await res.json();
      // Update with result
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id
            ? {
                ...a,
                status: data.status || "offline",
                lastHealthCheck: data.lastHealthCheck || new Date().toISOString(),
              }
            : a,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Health check failed");
      // Revert to previous status
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id ? { ...a, status: agent.status } : a,
        ),
      );
    } finally {
      setHealthCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(agent.id);
        return next;
      });
    }
  };

  // Edit agent
  const handleEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setFormName(agent.name);
    setFormDescription(agent.description ?? "");
    setFormModel(agent.model);
    setFormProvider(agent.provider ?? "");
    setFormRoleKey(agent.roleKey);
    setFormError(null);
    setShowCreateForm(true);
  };

  // Create new agent form
  const handleCreate = () => {
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormModel("");
    setFormProvider("");
    setFormRoleKey("");
    setFormError(null);
    setShowCreateForm(true);
  };

  // Submit edit/create
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: formName,
        description: formDescription || undefined,
        model: formModel,
        provider: formProvider || undefined,
        roleKey: formRoleKey || undefined,
      };

      const url = editingId ? `/api/agents/${editingId}` : "/api/agents";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(data.error || "Save failed");
      }

      setShowCreateForm(false);
      setEditingId(null);
      fetchAgents();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormModel("");
    setFormProvider("");
    setFormRoleKey("");
    setFormError(null);
    setEditingId(null);
    setShowCreateForm(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-zinc-300 border-t-[var(--color-accent)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Agent Management</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Monitor and manage AI agent profiles. Status auto-refreshes every 30 seconds.
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={handleCreate}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            + Create Agent
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Create/Edit form */}
      {showCreateForm && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            {editingId ? "Edit Agent" : "Create New Agent"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="e.g. Sales Assistant"
                  className="w-full rounded-[4px] border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Role Key{" "}
                  <span className="text-xs text-zinc-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formRoleKey}
                  onChange={(e) => setFormRoleKey(e.target.value)}
                  placeholder="e.g. sales, manager"
                  className="w-full rounded-[4px] border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Description
              </label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What this agent does"
                className="w-full rounded-[4px] border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  required
                  placeholder="e.g. gemini-2.0-flash-exp"
                  className="w-full rounded-[4px] border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Provider{" "}
                  <span className="text-xs text-zinc-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value)}
                  placeholder="e.g. google, openai, ollama"
                  className="w-full rounded-[4px] border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
                <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                {isSaving ? "Saving..." : editingId ? "Update Agent" : "Create Agent"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg px-4 py-2 text-sm font-medium border border-border text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Agent cards grid */}
      {agents.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No agents found. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const statusConfig = getStatusConfig(agent.status);
            const isChecking = healthCheckingIds.has(agent.id);
            return (
              <div
                key={agent.id}
                className="rounded-lg border border-gray-200 bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800"
              >
                {/* Header row: name + status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {agent.name}
                    </h3>
                    {agent.roleKey && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Role: <span className="font-mono">{agent.roleKey}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${statusConfig.dotClass} ${isChecking ? "animate-pulse" : ""}`}
                    />
                    <span className="text-xs font-medium" style={{ color: statusConfig.color }}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {agent.description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-2">
                    {agent.description}
                  </p>
                )}

                {/* Model */}
                <div className="mb-3">
                  <p className="text-xs text-zinc-400">Model</p>
                  <p className="text-sm text-foreground font-mono mt-0.5">
                    {agent.model}
                  </p>
                </div>

                {/* Provider */}
                {agent.provider && (
                  <div className="mb-3">
                    <p className="text-xs text-zinc-400">Provider</p>
                    <p className="text-sm text-foreground mt-0.5">{agent.provider}</p>
                  </div>
                )}

                {/* Skills count badge */}
                {agent.skillsCount !== undefined && (
                  <div className="mb-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: "rgba(0,180,166,0.15)",
                        color: "#00B4A6",
                      }}
                    >
                      {agent.skillsCount} skill{agent.skillsCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}

                {/* Last health check */}
                <div className="mb-4">
                  <p className="text-xs text-zinc-400">Last Health Check</p>
                  <p className="text-xs text-foreground mt-0.5">
                    {formatRelativeTime(agent.lastHealthCheck)}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-3 border-t border-border">
                  <button
                    onClick={() => handleCheckHealth(agent)}
                    disabled={isChecking}
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "var(--color-accent)" }}
                  >
                    {isChecking ? "Checking..." : "Check Health"}
                  </button>
                  <button
                    onClick={() => handleEdit(agent)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium border border-border text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}