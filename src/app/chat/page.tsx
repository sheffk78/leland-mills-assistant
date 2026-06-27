/**
 * Chat page — main chat interface with sidebar.
 *
 * Shows the sidebar (conversation list) + ChatInterface.
 * Responsive: sidebar collapses on mobile with a hamburger toggle.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, type ConversationListItem } from "@/components/Sidebar";
import { ChatInterface } from "@/components/ChatInterface";

export default function ChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    [],
  );
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationKey, setConversationKey] = useState(0);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch {
      // Silently fail — the chat still works without the sidebar
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleNewChat = useCallback(() => {
    // Navigate to /chat (fresh conversation) and reset the interface
    router.push("/chat");
    setConversationKey((k) => k + 1);
  }, [router]);

  const handleConversationCreated = useCallback(
    (id: string) => {
      // Replace URL without full navigation to avoid losing state
      router.replace(`/chat/${id}`);
      // Refresh conversation list
      fetchConversations();
    },
    [router, fetchConversations],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        conversations={conversations}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 text-foreground"
            aria-label="Open sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
              />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#FFB800" }}
            >
              <img
                src="/leland-mills-icon-mark.png"
                alt="Leland Mills"
                className="h-6 w-6 object-contain"
              />
            </div>
            <span className="text-sm font-semibold text-foreground">
              AI Assistant
            </span>
          </div>
        </div>

        <ChatInterface
          key={conversationKey}
          onConversationCreated={handleConversationCreated}
        />
      </div>
    </div>
  );
}