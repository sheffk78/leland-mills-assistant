/**
 * Admin: Role management page.
 *
 * - Table of roles with name, key, description, isAdmin/isSystem flags
 * - Create new role form
 * - Edit existing role (name, description, systemPrompt, isAdmin)
 * - Delete non-system roles (system roles show lock icon)
 *
 * Styled with the existing design system: teal #00B4A6 accent,
 * Satoshi body, Cabinet Grotesk headings.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  systemPrompt: string | null;
  isAdmin: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles", { cache: "no-store" });
      if (res.ok) {
        setRoles(await res.json());
      } else {
        setError("Failed to load roles");
      }
    } catch {
      setError("Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const resetForm = () => {
    setName("");
    setKey("");
    setDescription("");
    setSystemPrompt("");
    setIsAdmin(false);
    setFormError(null);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);

    try {
      const body: Record<string, unknown> = {
        name,
        description: description || undefined,
        systemPrompt: systemPrompt || undefined,
        isAdmin,
      };

      // Only send key if provided (auto-generated on backend otherwise)
      if (key) body.key = key;

      const url = editingId
        ? `/api/roles/${editingId}`
        : "/api/roles";
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

      resetForm();
      fetchRoles();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (role: Role) => {
    setEditingId(role.id);
    setName(role.name);
    setKey(role.key);
    setDescription(role.description ?? "");
    setSystemPrompt(role.systemPrompt ?? "");
    setIsAdmin(role.isAdmin);
    setFormError(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete the "${roleName}" role?`)) return;

    try {
      const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(data.error || "Delete failed");
      }
      fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    }
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
          <h2 className="text-xl font-semibold text-foreground">Role Management</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Create and manage user roles. System roles cannot be deleted.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            + Add Role
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            {editingId ? "Edit Role" : "Add New Role"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Manager, Supervisor"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Key{" "}
                  <span className="text-xs text-zinc-400">
                    {editingId ? "(cannot change for system roles)" : "(auto-generated from name if blank)"}
                  </span>
                </label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="e.g. manager, shift-supervisor"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Description{" "}
                <span className="text-xs text-zinc-400">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this role can do"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                System Prompt{" "}
                <span className="text-xs text-zinc-400">
                  (instructions for Archie when chatting with users of this role)
                </span>
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
                placeholder="e.g. [Context: The user {name} is a MANAGER. Focus on: team coordination, scheduling, performance metrics...]"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)] resize-y"
              />
              <p className="text-xs text-zinc-400 mt-1">
                Use <code className="font-mono">{"{name}"}</code> as a placeholder for the user&apos;s name.
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                />
                <span className="text-sm text-foreground">
                  Admin access{" "}
                  <span className="text-xs text-zinc-400">
                    (grants admin panel access for users with this role)
                  </span>
                </span>
              </label>
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {formError}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                {isSaving ? "Saving..." : editingId ? "Update Role" : "Create Role"}
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

      {/* Roles table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">
                Name
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">
                Key
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                Description
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">
                Admin
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">
                System
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {roles.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-sm text-zinc-500 dark:text-zinc-400">
                  No roles found. Run the migration script to seed default roles.
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-sm text-foreground font-medium">
                    {role.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 font-mono">
                    {role.key}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 hidden md:table-cell max-w-xs truncate">
                    {role.description ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {role.isAdmin ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                        Admin
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {role.isSystem ? (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        System
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(role)}
                        className="text-xs px-2 py-1 rounded text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        Edit
                      </button>
                      {!role.isSystem && (
                        <button
                          onClick={() => handleDelete(role.id, role.name)}
                          className="text-xs px-2 py-1 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}