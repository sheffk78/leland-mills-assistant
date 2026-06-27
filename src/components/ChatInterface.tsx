"use client";

/**
 * Main chat interface component.
 *
 * - Message list area (scrollable, auto-scroll to bottom)
 * - Input box at bottom with send button
 * - Loading state (typing indicator dots)
 * - Empty state
 * - Fetches and sends messages via the /api/chat route
 * - Dark mode support
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ChatMessage, type ChatMessageData } from "./ChatMessage";

interface ChatInterfaceProps {
  conversationId?: string;
  /** Called when a new conversation is created (to update URL) */
  onConversationCreated?: (id: string) => void;
  /** Initial messages to display (when loading an existing conversation) */
  initialMessages?: ChatMessageData[];
}

interface ApiResponse {
  response: string;
  conversationId: string;
  userMessageId?: string;
  assistantMessageId?: string;
  createdAt: string;
}

export function ChatInterface({
  conversationId,
  onConversationCreated,
  initialMessages,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>(
    initialMessages ?? [],
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentConversationId = useRef<string | undefined>(conversationId);

  // Update when conversationId prop changes (navigating to a different conversation)
  useEffect(() => {
    currentConversationId.current = conversationId;
    if (initialMessages) {
      setMessages(initialMessages);
    } else if (!conversationId) {
      setMessages([]);
    }
  }, [conversationId, initialMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isLoading) return;

      setError(null);
      setInput("");

      // Add user message immediately
      const userMsg: ChatMessageData = {
        role: "USER",
        content: text,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationId: currentConversationId.current,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "Request failed");
          throw new Error(errText);
        }

        const data: ApiResponse = await res.json();

        // Track conversation ID for subsequent messages
        if (
          !currentConversationId.current &&
          data.conversationId
        ) {
          currentConversationId.current = data.conversationId;
          onConversationCreated?.(data.conversationId);
        }

        // Add assistant response
        const assistantMsg: ChatMessageData = {
          id: data.assistantMessageId,
          role: "ASSISTANT",
          content: data.response,
          createdAt: data.createdAt,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        // Remove the user message on error so they can retry
        setMessages((prev) =>
          prev.filter((m) => m !== userMsg),
        );
        setInput(text); // Restore input
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, onConversationCreated],
  );

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto py-4"
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
            {/* Logo mark */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: "#FFB800" }}
            >
              <img
                src="/leland-mills-logo.png"
                alt="Leland Mills"
                className="h-10 w-auto"
              />
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-1">
              How can I help you today?
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-6">
              I&apos;m your Leland Mills operations assistant. Ask me about
              truck inspections, deliveries, feed inventory, safety procedures,
              or anything else related to daily operations.
            </p>

            {/* Educational starter prompts — organized by category */}
            <div className="w-full max-w-lg space-y-3">
              {/* Safety & Compliance */}
              <div className="text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600 mb-1.5 px-1">
                  Safety & Compliance
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Pre-trip inspection checklist",
                    "DOT hours of service limits",
                    "Lockout/tagout procedure",
                    "What makes a load secure?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-surface hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inventory & Feed */}
              <div className="text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600 mb-1.5 px-1">
                  Inventory & Feed
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Feed inventory reorder points",
                    "How should feed be stored?",
                    "What feed types do we carry?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-surface hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Getting Started */}
              <div className="text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600 mb-1.5 px-1">
                  Getting Started
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "What can you help me with?",
                    "How do I log a delivery?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-surface hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tip for new users */}
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-6 max-w-sm">
              New here? Just type a question in plain English below. No special
              commands needed.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <ChatMessage key={msg.id ?? i} message={msg} />
            ))}
            {isLoading && (
              <div className="flex justify-start px-4 py-2">
                <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3" style={{ borderLeft: "3px solid var(--color-accent)" }}>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-900">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border bg-background">
        <form
          onSubmit={sendMessage}
          className="max-w-3xl mx-auto flex items-end gap-2 p-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            rows={1}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
            style={{ maxHeight: "120px" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-accent)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}