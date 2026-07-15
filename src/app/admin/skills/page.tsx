/**
 * Admin: Skills Management page.
 *
 * - Toggle view: Grid view (cards) | Matrix view (roles × skills toggle table)
 * - Grid view: Cards organized by category, each with active/inactive toggle,
 *   role assignment dots, expandable details, Add Skill button
 * - Matrix view: Rows = skills, columns = roles, toggle on/off
 * - Add Skill form: name, description, category, content, role checkboxes
 * - Category filter and search bar at top
 *
 * Styled with the existing design system: teal #00B4A6 accent.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Skill {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  isSystem: boolean;
  version: number;
  roleAssignments: { roleKey: string; isEnabled: boolean }[];
  lastUpdated?: string;
}

interface Role {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
}

const CATEGORY_ORDER = [
  "Operations",
  "Finance",
  "HR",
  "Sales",
  "Inventory",
];

// Role color map for dots
const ROLE_COLORS: Record<string, string> = {
  admin: "#a855f7",
  staff: "#3b82f6",
  driver: "#22c55e",
  manager: "#f59e0b",
  sales: "#ec4899",
};

const getRoleColor = (key: string) =>
  ROLE_COLORS[key] ?? "#00B4A6";

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "matrix">("grid");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Operations");
  const [formContent, setFormContent] = useState("");
  const [formRoles, setFormRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [skillsRes, rolesRes] = await Promise.all([
        fetch("/api/skills", { cache: "no-store" }),
        fetch("/api/roles", { cache: "no-store" }),
      ]);

      if (!skillsRes.ok || !rolesRes.ok) {
        throw new Error("Failed to load skills or roles");
      }

      setSkills(await skillsRes.json());
      setRoles(await rolesRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.key.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || s.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [skills, search, categoryFilter]);

  const groupedSkills = useMemo(() => {
    const groups: Record<string, Skill[]> = {};
    for (const s of filteredSkills) {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    }
    const sortedCategories = Object.keys(groups).sort((a, b) => {
      const aIdx = CATEGORY_ORDER.indexOf(a);
      const bIdx = CATEGORY_ORDER.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    return sortedCategories.map((cat) => ({ category: cat, items: groups[cat] }));
  }, [filteredSkills]);

  const categories = useMemo(() => {
    const cats = new Set(skills.map((s) => s.category));
    return Array.from(cats);
  }, [skills]);

  // Toggle skill active/inactive
  const toggleActive = async (skill: Skill) => {
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !skill.isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle skill");
      setSkills((prev) =>
        prev.map((s) => (s.id === skill.id ? { ...s, isActive: !s.isActive } : s)),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  // Toggle skill assignment for a role (matrix view)
  const toggleAssignment = async (skill: Skill, roleKey: string) => {
    const current = skill.roleAssignments.find(
      (a) => a.roleKey === roleKey,
    );
    const isEnabled = current?.isEnabled ?? false;

    try {
      if (isEnabled) {
        const res = await fetch(`/api/skills/${skill.id}/assign`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleKey }),
        });
        if (!res.ok) throw new Error("Failed to unassign skill");
      } else {
        const res = await fetch(`/api/skills/${skill.id}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleKey }),
        });
        if (!res.ok) throw new Error("Failed to assign skill");
      }

      // Update local state
      setSkills((prev) =>
        prev.map((s) => {
          if (s.id !== skill.id) return s;
          const assignments = [...s.roleAssignments];
          const idx = assignments.findIndex((a) => a.roleKey === roleKey);
          if (idx >= 0) {
            assignments[idx] = { roleKey, isEnabled: !isEnabled };
          } else {
            assignments.push({ roleKey, isEnabled: true });
          }
          return { ...s, roleAssignments: assignments };
        }),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Assignment failed");
    }
  };

  // Add skill form submit
  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setIsSaving(true);
    try {
      const body = {
        name: formName,
        description: formDescription || undefined,
        category: formCategory,
        content: formContent || undefined,
        roleAssignments: formRoles,
      };
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Create failed" }));
        throw new Error(data.error || "Create failed");
      }
      // Reset form
      setFormName("");
      setFormDescription("");
      setFormCategory("Operations");
      setFormContent("");
      setFormRoles([]);
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormCategory("Operations");
    setFormContent("");
    setFormRoles([]);
    setActionError(null);
    setShowAddForm(false);
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
          <h2 className="text-xl font-semibold text-foreground">Skills Management</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage AI skills and assign them to roles
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            + Add Skill
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Add Skill form */}
      {showAddForm && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Add New Skill</h3>
          <form onSubmit={handleAddSkill} className="space-y-4">
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
                  placeholder="e.g. Invoice Processing"
                  className="w-full rounded-[4px] border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-[4px] border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
                >
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
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
                placeholder="Short description of what this skill does"
                className="w-full rounded-[4px] border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                SKILL.md Content{" "}
                <span className="text-xs text-zinc-400">(optional)</span>
              </label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={6}
                placeholder="# Skill Name&#10;&#10;Instructions for the AI agent..."
                className="w-full rounded-[4px] border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--color-accent)] resize-y font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Assign to Roles
              </label>
              <div className="flex flex-wrap gap-3">
                {roles.map((role) => (
                  <label
                    key={role.key}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formRoles.includes(role.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormRoles((prev) => [...prev, role.key]);
                        } else {
                          setFormRoles((prev) =>
                            prev.filter((r) => r !== role.key),
                          );
                        }
                      }}
                      className="w-4 h-4 rounded border-zinc-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                    />
                    <span className="text-sm text-foreground">{role.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {actionError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
                <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                {isSaving ? "Creating..." : "Create Skill"}
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

      {/* View toggle + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "grid"
                ? "text-white"
                : "text-foreground bg-surface hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            style={view === "grid" ? { backgroundColor: "var(--color-accent)" } : {}}
          >
            Grid
          </button>
          <button
            onClick={() => setView("matrix")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "matrix"
                ? "text-white"
                : "text-foreground bg-surface hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            style={view === "matrix" ? { backgroundColor: "var(--color-accent)" } : {}}
          >
            Matrix
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills..."
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

      {/* Action error */}
      {actionError && !showAddForm && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
        </div>
      )}

      {/* Grid View */}
      {view === "grid" && (
        <div className="space-y-6">
          {groupedSkills.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No skills found. Add one to get started.
            </div>
          ) : (
            groupedSkills.map(({ category, items }) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-foreground mb-3 px-1">
                  {category}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((skill) => {
                    const isExpanded = expandedId === skill.id;
                    return (
                      <div
                        key={skill.id}
                        className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm dark:bg-zinc-900 dark:border-zinc-800"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : skill.id)
                            }
                          >
                            <h4 className="text-sm font-semibold text-foreground">
                              {skill.name}
                            </h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                              {skill.description ?? "No description"}
                            </p>
                          </div>
                          <button
                            onClick={() => toggleActive(skill)}
                            className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${
                              skill.isActive ? "bg-[var(--color-accent)]" : "bg-zinc-300 dark:bg-zinc-700"
                            }`}
                            title={skill.isActive ? "Active" : "Inactive"}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                skill.isActive ? "translate-x-5" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Category badge */}
                        <div className="mt-3 flex items-center gap-2">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: "rgba(0,180,166,0.15)",
                              color: "#00B4A6",
                            }}
                          >
                            {skill.category}
                          </span>
                          {skill.isSystem && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              System
                            </span>
                          )}
                        </div>

                        {/* Role assignment dots */}
                        <div className="mt-3 flex items-center gap-1.5">
                          {skill.roleAssignments
                            .filter((a) => a.isEnabled)
                            .map((a) => (
                              <span
                                key={a.roleKey}
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: getRoleColor(a.roleKey) }}
                                title={a.roleKey}
                              />
                            ))}
                          {skill.roleAssignments.filter((a) => a.isEnabled).length === 0 && (
                            <span className="text-xs text-zinc-400">No roles assigned</span>
                          )}
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border space-y-2">
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="font-medium text-foreground">Key:</span>{" "}
                              <span className="font-mono">{skill.key}</span>
                            </div>
                            {skill.description && (
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                <span className="font-medium text-foreground">Description:</span>{" "}
                                {skill.description}
                              </div>
                            )}
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="font-medium text-foreground">Version:</span>{" "}
                              {skill.version}
                            </div>
                            {skill.lastUpdated && (
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                <span className="font-medium text-foreground">Last Updated:</span>{" "}
                                {new Date(skill.lastUpdated).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </div>
                            )}
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="font-medium text-foreground">Role Assignments:</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {roles.map((role) => {
                                const assigned = skill.roleAssignments.find(
                                  (a) => a.roleKey === role.key,
                                )?.isEnabled;
                                return (
                                  <span
                                    key={role.key}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                      assigned
                                        ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                                        : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                                    }`}
                                  >
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: getRoleColor(role.key) }}
                                    />
                                    {role.name}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Matrix View */}
      {view === "matrix" && (
        <div className="rounded-xl border border-border overflow-hidden">
          {filteredSkills.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No skills found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3 sticky left-0 bg-surface z-10">
                      Skill
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
                  {filteredSkills.map((skill) => (
                    <tr
                      key={skill.id}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 sticky left-0 bg-background z-10">
                        <div className="text-sm text-foreground font-medium">
                          {skill.name}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {skill.category}
                        </div>
                      </td>
                      {roles.map((role) => {
                        const assigned = skill.roleAssignments.find(
                          (a) => a.roleKey === role.key,
                        )?.isEnabled;
                        return (
                          <td key={role.key} className="px-3 py-3 text-center">
                            <button
                              onClick={() => toggleAssignment(skill, role.key)}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-[4px] transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                              title={assigned ? "Assigned (click to remove)" : "Not assigned (click to assign)"}
                            >
                              {assigned ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#00B4A6"
                                  strokeWidth={3}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="w-5 h-5"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
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
          )}
        </div>
      )}
    </div>
  );
}