"use client";

/**
 * Conversation list sidebar.
 *
 * - "New Chat" button at top
 * - List of past conversations (titles, dates)
 * - Active conversation highlighting
 * - Collapsible on mobile (via parent-controlled open state)
 * - Dark mode support
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ConversationListItem {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface SidebarProps {
  conversations: ConversationListItem[];
  activeId?: string;
  onNewChat?: () => void;
  /** Whether sidebar is open (mobile). Parent controls this. */
  isOpen?: boolean;
  /** Called when user closes sidebar (mobile) */
  onClose?: () => void;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  const diffDays = diffHrs / 24;

  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Sidebar({
  conversations,
  activeId,
  onNewChat,
  isOpen,
  onClose,
}: SidebarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = searchQuery
    ? conversations.filter((c) =>
        (c.title ?? "Untitled conversation")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      )
    : conversations;

  const handleNewChat = () => {
    onNewChat?.();
    onClose?.();
  };

  const handleSelect = (id: string) => {
    router.push(`/chat/${id}`);
    onClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-72 shrink-0 flex flex-col
          bg-surface border-r border-border
          transition-transform duration-200
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Header section */}
        <div className="p-3 border-b border-border">
          {/* Gold brand band matching lelandmills.com */}
          <div
            className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-lg"
            style={{ backgroundColor: "#FFB800" }}
          >
            <img
              src="/leland-mills-logo.png"
              alt="Leland Mills"
              className="h-6 w-auto"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-black/70 font-medium">
                AI Assistant
              </p>
            </div>
            {/* Close button (mobile) */}
            <button
              onClick={onClose}
              className="md:hidden p-1 text-black/70 hover:text-black"
              aria-label="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L10.586 12l-5.775 5.775a1 1 0 0 0 1.414 1.414L12 13.414l5.775 5.775a1 1 0 0 0 1.414-1.414L13.414 12l5.775-5.775a1 1 0 0 0-1.414-1.414L12 10.586 6.225 4.811Z" />
              </svg>
            </button>
          </div>

          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--color-accent)", color: "#000000" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 4.5v15m7.5-7.5h-15" strokeWidth={1.5} stroke="currentColor" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Search */}
        {conversations.length > 5 && (
          <div className="px-3 py-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5 text-foreground placeholder:text-zinc-400 focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {conversations.length === 0
                  ? "No conversations yet. Start a new chat!"
                  : "No conversations match your search."}
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((conv) => {
                const isActive = conv.id === activeId;
                return (
                  <li key={conv.id}>
                    <button
                      onClick={() => handleSelect(conv.id)}
                      className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                        isActive
                          ? "bg-[var(--color-accent-light)] text-foreground"
                          : "hover:bg-black/5 dark:hover:bg-white/5 text-foreground"
                      }`}
                      style={
                        isActive
                          ? { borderLeft: "3px solid var(--color-accent)" }
                          : { borderLeft: "3px solid transparent" }
                      }
                    >
                      <p className="text-sm font-medium truncate">
                        {conv.title ?? "Untitled conversation"}
                      </p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {formatRelativeDate(conv.updatedAt)}
                        </span>
                        {conv._count && conv._count.messages > 0 && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                            {conv._count.messages} msg
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <button
            onClick={() => router.push("/admin/settings")}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.522.23-.97.05-1.354C9.21 1.625 7.71.75 6.75.75a3.75 3.75 0 0 0-3 6c.234.297.378.522.422.75.044.228-.016.482-.172.825-.293.633-.66 1.25-1.062 1.832a3.75 3.75 0 0 0 4.5 5.596c.337-.157.592-.216.82-.172.228.044.453.188.75.422a3.75 3.75 0 0 0 6-3 3.75 3.75 0 0 0-4.5-3.596c-.343.156-.597.216-.825.172-.228-.044-.452-.188-.75-.422A3.75 3.75 0 0 0 6.75 15.75" />
            </svg>
            Settings
          </button>
        </div>
      </aside>
    </>
  );
}