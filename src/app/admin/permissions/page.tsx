/**
 * Admin: Permissions Management page.
 *
 * - Matrix table: rows = permissions, columns = roles, cells = toggle switches
 * - Permissions grouped by category (HR, Finance, Operations, Sales, Admin)
 * - Each cell: green check for allow, red X for deny, empty for not assigned
 * - Click a cell to cycle: not assigned → allow (green) → deny (red) → not assigned
 * - "Save Changes" button calls PUT /api/permissions/role/[roleKey] for each changed role
 * - Search/filter bar at top to filter permissions by name or category
 *
 * Styled with the existing design system: teal #00B4A6 accent.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Permission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
}

interface Role {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
}

interface RolePermission {
  permissionKey: string;
  effect: string; // "allow" | "deny"
}

// Cell state: "allow" | "deny" | undefined (not assigned)
// Matrix: { [roleKey]: { [permissionKey]: "allow" | "deny" | undefined } }
type Matrix = Record<string, Record<string, "allow" | "deny" | undefined>>;

// Category order for grouping
const CATEGORY_ORDER = ["HR", "Finance", "Operations", "Sales", "Admin"];

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [matrix, setMatrix] = useState<Matrix>({});
  const [originalMatrix, setOriginalMatrix] = useState<Matrix>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      // Fetch all permissions and roles in parallel
      const [permRes, rolesRes] = await Promise.all([
        fetch("/api/permissions", { cache: "no-store" }),
        fetch("/api/roles", { cache: "no-store" }),
      ]);

      if (!permRes.ok || !rolesRes.ok) {
        throw new Error("Failed to load permissions or roles");
      }

      const perms: Permission[] = await permRes.json();
      const rolesData: Role[] = await rolesRes.json();

      setPermissions(perms);
      setRoles(rolesData);

      // Fetch each role's permission assignments in parallel
      const rolePermResults = await Promise.all(
        rolesData.map(async (role) => {
          try {
            const res = await fetch(`/api/permissions/role/${role.key}`, {
              cache: "no-store",
            });
            if (!res.ok) return { roleKey: role.key, assignments: [] as RolePermission[] };
            const assignments: RolePermission[] = await res.json();
            return { roleKey: role.key, assignments };
          } catch {
            return { roleKey: role.key, assignments: [] as RolePermission[] };
          }
        }),
      );

      // Build matrix
      const m: Matrix = {};
      for (const { roleKey, assignments } of rolePermResults) {
        m[roleKey] = {};
        for (const perm of perms) {
          const assignment = assignments.find((a) => a.permissionKey === perm.key);
          m[roleKey][perm.key] = assignment
            ? (assignment.effect as "allow" | "deny")
            : undefined;
        }
      }

      setMatrix(m);
      setOriginalMatrix(JSON.parse(JSON.stringify(m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter permissions by search and category
  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.key.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [permissions, search, categoryFilter]);

  // Group filtered permissions by category
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    for (const p of filteredPermissions) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    // Sort categories by predefined order, then any extras
    const sortedCategories = Object.keys(groups).sort((a, b) => {
      const aIdx = CATEGORY_ORDER.indexOf(a);
      const bIdx = CATEGORY_ORDER.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    return sortedCategories.map((cat) => ({ category: cat, items: groups[cat] }));
  }, [filteredPermissions]);

  // Detect if there are unsaved changes
  const hasChanges = useMemo(() => {
    for (const roleKey of Object.keys(matrix)) {
      const orig = originalMatrix[roleKey] || {};
      const curr = matrix[roleKey] || {};
      for (const permKey of new Set([...Object.keys(orig), ...Object.keys(curr)])) {
        if ((orig[permKey] ?? undefined) !== (curr[permKey] ?? undefined)) {
          return true;
        }
      }
    }
    return false;
  }, [matrix, originalMatrix]);

  // Cycle cell state: undefined → "allow" → "deny" → undefined
  const cycleCell = (roleKey: string, permKey: string) => {
    setMatrix((prev) => {
      const rolePerms = { ...(prev[roleKey] || {}) };
      const current = rolePerms[permKey];
      if (current === undefined) {
        rolePerms[permKey] = "allow";
      } else if (current === "allow") {
        rolePerms[permKey] = "deny";
      } else {
        rolePerms[permKey] = undefined;
      }
      return { ...prev, [roleKey]: rolePerms };
    });
    setSaveStatus(null);
  };

  // Save changes: for each changed role, PUT full permission set
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const changedRoles: string[] = [];
      for (const roleKey of Object.keys(matrix)) {
        const orig = originalMatrix[roleKey] || {};
        const curr = matrix[roleKey] || {};
        for (const permKey of new Set([...Object.keys(orig), ...Object.keys(curr)])) {
          if ((orig[permKey] ?? undefined) !== (curr[permKey] ?? undefined)) {
            changedRoles.push(roleKey);
            break;
          }
        }
      }

      const results = await Promise.all(
        changedRoles.map(async (roleKey) => {
          const rolePerms = matrix[roleKey] || {};
          const assignments = Object.entries(rolePerms)
            .filter(([, effect]) => effect !== undefined)
            .map(([permissionKey, effect]) => ({
              permissionKey,
              effect: effect as string,
            }));
          const res = await fetch(`/api/permissions/role/${roleKey}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignments }),
          });
          return { roleKey, ok: res.ok };
        }),
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        setSaveStatus(
          `Failed to save ${failed.length} role(s): ${failed.map((f) => f.roleKey).join(", ")}`,
        );
      } else {
        setSaveStatus(`Saved ${changedRoles.length} role permission set(s) successfully.`);
        setOriginalMatrix(JSON.parse(JSON.stringify(matrix)));
      }
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(permissions.map((p) => p.category));
    return Array.from(cats);
  }, [permissions]);

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
          <h2 className="text-xl font-semibold text-foreground">Permissions Management</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage which roles can perform which actions. Click a cell to cycle:
            empty → allow (green) → deny (red) → empty.
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search permissions..."
          className="flex-1 min-w-[200px] rounded-[4px] border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-[4px] border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Permissions matrix */}
      {roles.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No roles found. Create roles first to manage permissions.
        </div>
      ) : filteredPermissions.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No permissions match your filter.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedPermissions.map(({ category, items }) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-foreground mb-2 px-1">
                {category}
              </h3>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface border-b border-border">
                      <tr>
                        <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3 sticky left-0 bg-surface z-10">
                          Permission
                        </th>
                        {roles.map((role) => (
                          <th
                            key={role.key}
                            className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-3 py-3 min-w-[80px]"
                          >
                            {role.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((perm) => (
                        <tr
                          key={perm.key}
                          className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                        >
                          <td className="px-4 py-3 sticky left-0 bg-background z-10">
                            <div className="text-sm text-foreground font-medium">
                              {perm.name}
                            </div>
                            {perm.description && (
                              <div className="text-xs text-zinc-400 mt-0.5">
                                {perm.description}
                              </div>
                            )}
                          </td>
                          {roles.map((role) => {
                            const cellState = matrix[role.key]?.[perm.key];
                            return (
                              <td
                                key={role.key}
                                className="px-3 py-3 text-center"
                              >
                                <button
                                  onClick={() => cycleCell(role.key, perm.key)}
                                  className="w-8 h-8 inline-flex items-center justify-center rounded-[4px] transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                                  title={
                                    cellState === "allow"
                                      ? "Allow (click to deny)"
                                      : cellState === "deny"
                                        ? "Deny (click to clear)"
                                        : "Not assigned (click to allow)"
                                  }
                                >
                                  {cellState === "allow" && (
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="#16a34a"
                                      strokeWidth={3}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="w-5 h-5"
                                    >
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                  {cellState === "deny" && (
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="#dc2626"
                                      strokeWidth={3}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="w-5 h-5"
                                    >
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  )}
                                  {cellState === undefined && (
                                    <span className="block w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save bar */}
      {roles.length > 0 && filteredPermissions.length > 0 && (
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          {hasChanges && !isSaving && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Unsaved changes
            </span>
          )}
          {saveStatus && (
            <span
              className={`text-sm ${saveStatus.startsWith("Failed") ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
            >
              {saveStatus}
            </span>
          )}
        </div>
      )}
    </div>
  );
}