/**
 * Mock helpers for unit tests.
 *
 * Provides mock implementations of Prisma, NextAuth, and fetch
 * so API route tests can run without a real database or agent.
 */

import { vi } from "vitest";

/** Deep mock of the Prisma client. Each model gets a mock object. */
export function createMockPrisma() {
  const mockModel = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  });

  return {
    user: mockModel(),
    conversation: mockModel(),
    message: mockModel(),
    knowledgeEntry: mockModel(),
    driveFile: mockModel(),
    $disconnect: vi.fn(),
  };
}

/** Create a mock NextAuth session object. */
export function createMockSession(overrides: Partial<{
  user: {
    id: string;
    email: string | null;
    name: string;
    role: "ADMIN" | "STAFF" | "DRIVER";
  };
}> = {}) {
  return {
    user: {
      id: "test-user-id",
      email: "admin@lelandmills.com",
      name: "Test Admin",
      role: "ADMIN" as const,
      ...overrides.user,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

/** Create a mock Request object for API route tests. */
export function createMockRequest(
  body: unknown,
  options: { method?: string; headers?: Record<string, string> } = {},
) {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost:3000/api/test", {
    method: options.method ?? "POST",
    headers: { "Content-Type": "application/json", ...options.headers },
    body: bodyStr,
  });
}

/** Create a mock NextRequest with dynamic params (Next.js 16 style). */
export function createMockParams(id: string) {
  return Promise.resolve({ id });
}