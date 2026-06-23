/**
 * Specific conversation page.
 *
 * Loads an existing conversation and its messages, then renders the same
 * sidebar + ChatInterface layout.
 *
 * In Next.js 16, `params` is a Promise and must be awaited.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, type ConversationListItem } from "@/components/Sidebar";
import { ChatInterface } from "@/components/ChatInterface";
import type { ChatMessageData } from "@/components/ChatMessage";

interface ConversationData {
  id: string;
  title: string | null;
  messages: Array<{
    id: string;
    role: "USER" | "ASSISTANT" | "SYSTEM";
    content: string;
    createdAt: string;
  }>;
}

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessageData[] | undefined>();
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Unwrap the params promise
  useEffect(() => {
    params.then(({ id }) => setConversationId(id));
  }, [params]);

  // Fetch the conversation messages
  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;

    async function loadConversation() {
      if (!conversationId) return;
      try {
        const res = await fetch(`/api/conversations/${conversationId}`, {
          cache: "no-store",
        });
        if (res.ok && !cancelled) {
          const data: ConversationData = await res.json();
          setMessages(
            data.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            })),
          );
        } else if (!cancelled) {
          // Conversation not found or error — redirect to fresh chat
          router.replace("/chat");
        }
      } catch {
        if (!cancelled) {
          router.replace("/chat");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadConversation();

    return () => {
      cancelled = true;
    };
  }, [conversationId, router]);

  // Fetch conversation list for sidebar
  useEffect(() => {
    async function fetchConversations() {
      try {
        const res = await fetch("/api/conversations", { cache: "no-store" });
        if (res.ok) {
          setConversations(await res.json());
        }
      } catch {
        // Silent fail
      }
    }
    fetchConversations();
  }, [conversationId]);

  const handleNewChat = useCallback(() => {
    router.push("/chat");
    setSidebarOpen(false);
  }, [router]);

  const handleConversationCreated = useCallback(
    (id: string) => {
      router.replace(`/chat/${id}`);
    },
    [router],
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-300 border-t-[var(--color-accent)] rounded-full animate-spin" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading conversation...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        conversations={conversations}
        activeId={conversationId}
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
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--color-accent)" }}
            >
              <span className="text-white font-bold text-xs">LM</span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              AI Assistant
            </span>
          </div>
        </div>

        <ChatInterface
          conversationId={conversationId}
          initialMessages={messages}
          onConversationCreated={handleConversationCreated}
        />
      </div>
    </div>
  );
}