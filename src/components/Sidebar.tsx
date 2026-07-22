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
import { signOut } from "next-auth/react";

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
          {/* Logo on gold background, white logo version */}
          <div className="flex items-center gap-2.5 mb-3 px-2 py-2 rounded-lg" style={{ backgroundColor: "#FFB800" }}>
            <img
              src="/leland-mills-logo-white-on-transparent.png"
              alt="Leland Mills"
              className="h-8 w-auto object-contain"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-black/70 font-medium">
                AI Assistant
              </p>
            </div>
            {/* Close button (mobile) */}
            <button
              onClick={onClose}
              className="md:hidden p-1 text-foreground hover:opacity-60"
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
        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={() => { router.push("/admin/usage"); onClose?.(); }}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
            Usage &amp; Limits
          </button>
          <button
            onClick={() => { router.push("/admin/settings"); onClose?.(); }}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Settings
          </button>
          <button
            onClick={() => { onClose?.(); signOut({ callbackUrl: "/login" }); }}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 1 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            Log Out
          </button>
        </div>
      </aside>
    </>
  );
}