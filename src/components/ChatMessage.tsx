"use client";

/**
 * Individual chat message bubble.
 *
 * - User messages: right-aligned, dark background
 * - Assistant messages: left-aligned, light/teal background
 * - Supports basic markdown rendering (bold, italic, code, lists, headings)
 * - Timestamp display
 * - Dark mode variants
 * - Inline image attachment display
 */

import { useMemo } from "react";

export interface ChatAttachment {
  id: string;
  filename: string;
  url: string;
  mimetype: string;
  filesize: number;
}

export interface ChatMessageData {
  id?: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string | Date;
  attachments?: ChatAttachment[];
}

/**
 * Convert a limited subset of markdown to sanitized HTML.
 *
 * Supports: headings (##), bold (**), italic (*), inline code (`),
 * unordered lists (-), ordered lists (1.), and paragraphs.
 *
 * This intentionally avoids a full markdown parser dependency.
 * Output is escaped before any HTML tags are applied.
 */
function renderMarkdown(text: string): string {
  // Escape HTML first to prevent injection
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  let html = escaped;

  // Headings (## or ###)
  html = html.replace(/^### (.+)$/gm, '<h3 class="font-semibold text-base mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="font-semibold text-lg mt-3 mb-1">$1</h2>');

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');

  // Italic *text* (but not if it's part of ** which we already handled)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // Inline code `text`
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded text-sm font-mono bg-black/10 dark:bg-white/10">$1</code>',
  );

  // Split into lines for list/paragraph processing
  const lines = html.split("\n");
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Unordered list item: - text
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inUl) {
        result.push('<ul class="list-disc pl-5 my-1 space-y-0.5">');
        inUl = true;
      }
      result.push(`<li>${trimmed.slice(2)}</li>`);
      continue;
    }

    // Ordered list item: 1. text
    const olMatch = trimmed.match(/^\d+\.\s(.+)/);
    if (olMatch) {
      if (!inOl) {
        result.push('<ol class="list-decimal pl-5 my-1 space-y-0.5">');
        inOl = true;
      }
      result.push(`<li>${olMatch[1]}</li>`);
      continue;
    }

    // Close any open lists
    if (inUl) {
      result.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      result.push("</ol>");
      inOl = false;
    }

    // Empty line → spacing
    if (trimmed === "") {
      continue;
    }

    // Regular paragraph (skip if it's already an HTML tag like h2/h3)
    if (trimmed.startsWith("<h2") || trimmed.startsWith("<h3")) {
      result.push(trimmed);
    } else {
      result.push(`<p class="my-1">${trimmed}</p>`);
    }
  }

  // Close any dangling lists
  if (inUl) result.push("</ul>");
  if (inOl) result.push("</ol>");

  return result.join("");
}

function formatTime(date: string | Date | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "USER";
  const isSystem = message.role === "SYSTEM";
  const html = useMemo(
    () => (isUser ? message.content : renderMarkdown(message.content)),
    [message.content, isUser],
  );

  if (isSystem) {
    return (
      <div className="flex justify-center px-4 py-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400 italic">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex w-full px-4 py-2 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-zinc-800 text-white dark:bg-zinc-700 rounded-br-sm"
            : "bg-surface text-foreground border border-border rounded-bl-sm"
        }`}
        style={
          !isUser
            ? { borderLeft: "3px solid var(--color-accent)" }
            : undefined
        }
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-accent)" }}
            />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Jake
            </span>
          </div>
        )}
        {/* Attachment display — images show inline, documents show download card */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.attachments.map((att) => {
              const isImage = att.mimetype.startsWith("image/");
              if (isImage) {
                return (
                  <div key={att.id}>
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <img
                        src={att.url}
                        alt={att.filename}
                        className="max-w-[200px] max-h-[200px] rounded-lg object-cover border border-white/20 group-hover:opacity-80 transition-opacity"
                      />
                    </a>
                    <a
                      href={`/api/files/${att.id}/download`}
                      className="block text-[10px] mt-0.5 text-zinc-400 hover:text-[var(--color-accent)] transition-colors truncate max-w-[200px]"
                    >
                      ⬇ {att.filename} ({formatFileSize(att.filesize)})
                    </a>
                  </div>
                );
              }
              // Non-image: render as download card with teal accent border
              return (
                <a
                  key={att.id}
                  href={`/api/files/${att.id}/download`}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors max-w-[250px]"
                  style={{ borderColor: "#00B4A6" }}
                >
                  <span className="text-2xl shrink-0">📄</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {att.filename}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {formatFileSize(att.filesize)}
                    </p>
                  </div>
                  <span className="text-[var(--color-accent)] text-xs shrink-0 ml-auto">
                    ⬇
                  </span>
                </a>
              );
            })}
          </div>
        )}
        <div
          className="text-sm leading-relaxed prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {message.createdAt && (
          <div
            className={`text-[10px] mt-1.5 ${
              isUser
                ? "text-zinc-400 dark:text-zinc-300"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {formatTime(message.createdAt)}
          </div>
        )}
      </div>
    </div>
  );
}