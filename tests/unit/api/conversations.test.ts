/**
 * Tests for /api/conversations routes.
 *
 * Tests listing, creating, fetching, and deleting conversations
 * with proper auth and ownership enforcement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    conversation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET as ListGET, POST as ListPOST } from "@/app/api/conversations/route";
import { GET as DetailGET, DELETE as DetailDELETE } from "@/app/api/conversations/[id]/route";

function makeRequest(method = "GET", body?: unknown) {
  return new Request("http://localhost:3000/api/conversations", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/conversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await ListGET();
    expect(res.status).toBe(401);
  });

  it("returns conversations for the authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    const convos = [
      { id: "c1", title: "Pre-trip", updatedAt: new Date().toISOString(), _count: { messages: 3 } },
      { id: "c2", title: "Inventory", updatedAt: new Date().toISOString(), _count: { messages: 1 } },
    ];
    vi.mocked(prisma.conversation.findMany).mockResolvedValue(convos as never);

    const res = await ListGET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
  });
});

describe("POST /api/conversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await ListPOST(makeRequest("POST", {}));
    expect(res.status).toBe(401);
  });

  it("creates a conversation with a custom title", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.conversation.create).mockResolvedValue({ id: "new-conv", userId: "u1", title: "My Chat" } as never);

    const res = await ListPOST(makeRequest("POST", { title: "My Chat" }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe("new-conv");
  });

  it("creates a conversation with default title when no title provided", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.conversation.create).mockResolvedValue({ id: "new-conv", userId: "u1", title: "New Conversation" } as never);

    const req = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
      body: "",
    });
    const res = await ListPOST(req);
    expect(res.status).toBe(201);
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: { userId: "u1", title: "New Conversation" },
    });
  });
});

describe("GET /api/conversations/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await DetailGET(
      new Request("http://localhost:3000/api/conversations/c1"),
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when conversation does not exist or belongs to another user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue(null);

    const res = await DetailGET(
      new Request("http://localhost:3000/api/conversations/c1"),
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns conversation with messages when owned by user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    const convo = {
      id: "c1",
      userId: "u1",
      title: "Pre-trip",
      messages: [
        { id: "m1", role: "USER", content: "question", createdAt: new Date().toISOString() },
        { id: "m2", role: "ASSISTANT", content: "answer", createdAt: new Date().toISOString() },
      ],
    };
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue(convo as never);

    const res = await DetailGET(
      new Request("http://localhost:3000/api/conversations/c1"),
      { params: Promise.resolve({ id: "c1" }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.messages).toHaveLength(2);
  });
});

describe("DELETE /api/conversations/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await DetailDELETE(
      new Request("http://localhost:3000/api/conversations/c1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when conversation not found", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue(null);

    const res = await DetailDELETE(
      new Request("http://localhost:3000/api/conversations/c1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res.status).toBe(404);
  });

  it("deletes conversation when owned by user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: "c1", userId: "u1" } as never);
    vi.mocked(prisma.conversation.delete).mockResolvedValue({ id: "c1" } as never);

    const res = await DetailDELETE(
      new Request("http://localhost:3000/api/conversations/c1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.conversation.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});