/**
 * Tests for /api/chat route.
 *
 * Tests authentication, validation, conversation creation,
 * message persistence, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies — factory functions avoid hoisting issues
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    message: { create: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/hermes-client", () => ({
  sendChatMessage: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendChatMessage } from "@/lib/hermes-client";
import { POST } from "@/app/api/chat/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest({ message: "hello" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when session has no user id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as never);
    const res = await POST(makeRequest({ message: "hello" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is missing", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is not a string", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    const res = await POST(makeRequest({ message: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when conversationId does not belong to user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue(null);

    const res = await POST(makeRequest({ message: "hello", conversationId: "bad-id" }));
    expect(res.status).toBe(404);
  });

  it("creates a new conversation when no conversationId is provided", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.conversation.create).mockResolvedValue({ id: "conv-1" } as never);
    vi.mocked(prisma.message.create).mockResolvedValue({ id: "msg-1" } as never);
    vi.mocked(prisma.message.findMany).mockResolvedValue([]);
    vi.mocked(sendChatMessage).mockResolvedValue({ response: "AI reply", conversationId: "conv-1" } as never);

    const res = await POST(makeRequest({ message: "Pre-trip inspection checklist" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.response).toBe("AI reply");
    expect(data.conversationId).toBe("conv-1");
  });

  it("truncates long messages for conversation title", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    const longMsg = "A".repeat(100);
    vi.mocked(prisma.conversation.create).mockResolvedValue({ id: "conv-1" } as never);
    vi.mocked(prisma.message.create).mockResolvedValue({ id: "msg-1" } as never);
    vi.mocked(prisma.message.findMany).mockResolvedValue([]);
    vi.mocked(sendChatMessage).mockResolvedValue({ response: "reply", conversationId: "conv-1" } as never);

    await POST(makeRequest({ message: longMsg }));

    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "A".repeat(50) + "...",
        }),
      }),
    );
  });

  it("stores both user and assistant messages in the database", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.conversation.create).mockResolvedValue({ id: "conv-1" } as never);
    vi.mocked(prisma.message.create).mockResolvedValue({ id: "msg-1" } as never);
    vi.mocked(prisma.message.findMany).mockResolvedValue([]);
    vi.mocked(sendChatMessage).mockResolvedValue({ response: "AI reply", conversationId: "conv-1" } as never);

    await POST(makeRequest({ message: "hello" }));

    expect(prisma.message.create).toHaveBeenCalledTimes(2);
    expect(prisma.message.create).toHaveBeenNthCalledWith(1, {
      data: { conversationId: "conv-1", role: "USER", content: "hello" },
    });
    expect(prisma.message.create).toHaveBeenNthCalledWith(2, {
      data: { conversationId: "conv-1", role: "ASSISTANT", content: "AI reply" },
    });
  });

  it("passes conversation history to the Hermes client", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: "conv-existing" } as never);
    vi.mocked(prisma.message.findMany).mockResolvedValue([
      { role: "USER", content: "previous question" },
      { role: "ASSISTANT", content: "previous answer" },
    ]);
    vi.mocked(prisma.message.create).mockResolvedValue({ id: "msg-1" } as never);
    vi.mocked(sendChatMessage).mockResolvedValue({ response: "reply", conversationId: "conv-existing" } as never);

    await POST(makeRequest({ message: "follow up", conversationId: "conv-existing" }));

    expect(sendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "follow up",
        conversationId: "conv-existing",
        history: expect.arrayContaining([
          expect.objectContaining({ role: "USER", content: "previous question" }),
        ]),
      }),
    );
  });

  it("returns 502 when Hermes agent is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.conversation.create).mockResolvedValue({ id: "conv-1" } as never);
    vi.mocked(prisma.message.create).mockResolvedValue({ id: "msg-1" } as never);
    vi.mocked(prisma.message.findMany).mockResolvedValue([]);
    vi.mocked(sendChatMessage).mockRejectedValue(new Error("Connection refused"));

    const res = await POST(makeRequest({ message: "hello" }));
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toContain("unavailable");
  });
});