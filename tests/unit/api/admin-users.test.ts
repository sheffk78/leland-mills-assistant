/**
 * Tests for /api/admin/users routes.
 *
 * Tests admin-only access, user CRUD, role validation,
 * duplicate email prevention, and self-deletion protection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-value"),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue("hashed-value"),
  compare: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET as ListGET, POST as ListPOST } from "@/app/api/admin/users/route";
import { PUT as DetailPUT, DELETE as DetailDELETE } from "@/app/api/admin/users/[id]/route";

function makeRequest(method: string, body?: unknown) {
  return new Request("http://localhost:3000/api/admin/users", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/admin/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await ListGET();
    expect(res.status).toBe(403);
  });

  it("returns 403 for non-admin users", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "STAFF" } } as never);
    const res = await ListGET();
    expect(res.status).toBe(403);
  });

  it("returns 403 for driver users", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "DRIVER" } } as never);
    const res = await ListGET();
    expect(res.status).toBe(403);
  });

  it("returns user list for admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    const users = [
      { id: "u1", email: "a@lelandmills.com", name: "Alice", role: "STAFF", lastLogin: null },
      { id: "u2", email: null, name: "Driver Bob", role: "DRIVER", lastLogin: null },
    ];
    vi.mocked(prisma.user.findMany).mockResolvedValue(users as never);

    const res = await ListGET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
    // Passwords should never be in the select
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
          role: true,
        }),
      }),
    );
  });
});

describe("POST /api/admin/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "STAFF" } } as never);
    const res = await ListPOST(makeRequest("POST", { name: "Test", role: "STAFF", email: "t@lm.com", password: "pass" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    const res = await ListPOST(makeRequest("POST", { role: "STAFF", email: "t@lm.com", password: "pass" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when role is invalid", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    const res = await ListPOST(makeRequest("POST", { name: "Test", role: "SUPERADMIN" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email missing for ADMIN role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    const res = await ListPOST(makeRequest("POST", { name: "Test", role: "ADMIN", password: "pass" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when PIN missing for DRIVER role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    const res = await ListPOST(makeRequest("POST", { name: "Driver", role: "DRIVER" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate email", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existing" } as never);

    const res = await ListPOST(makeRequest("POST", { name: "Test", role: "STAFF", email: "existing@lm.com", password: "pass" }));
    expect(res.status).toBe(409);
  });

  it("creates a staff user successfully", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "new-user",
      email: "new@lelandmills.com",
      name: "New User",
      role: "STAFF",
    } as never);

    const res = await ListPOST(makeRequest("POST", {
      name: "New User",
      role: "STAFF",
      email: "new@lelandmills.com",
      password: "securepass",
    }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe("new-user");
  });

  it("creates a driver user with PIN code (no email)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "driver-1",
      email: null,
      name: "Driver Joe",
      role: "DRIVER",
    } as never);

    const res = await ListPOST(makeRequest("POST", {
      name: "Driver Joe",
      role: "DRIVER",
      pinCode: "1234",
    }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.role).toBe("DRIVER");
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Driver Joe",
          email: null,
          role: "DRIVER",
        }),
      }),
    );
  });
});

describe("PUT /api/admin/users/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "STAFF" } } as never);
    const res = await DetailPUT(
      makeRequest("PUT", { name: "Updated" }),
      { params: Promise.resolve({ id: "u2" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when user does not exist", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await DetailPUT(
      makeRequest("PUT", { name: "Updated" }),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    expect(res.status).toBe(404);
  });

  it("prevents admin from demoting their own account", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "admin1", role: "ADMIN" } as never);

    const res = await DetailPUT(
      makeRequest("PUT", { role: "STAFF" }),
      { params: Promise.resolve({ id: "admin1" }) },
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("demote");
  });

  it("updates user name successfully", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u2", name: "Old" } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: "u2", name: "New Name", role: "STAFF" } as never);

    const res = await DetailPUT(
      makeRequest("PUT", { name: "New Name" }),
      { params: Promise.resolve({ id: "u2" }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("New Name");
  });
});

describe("DELETE /api/admin/users/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prevents admin from deleting their own account", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);

    const res = await DetailDELETE(
      new Request("http://localhost:3000/api/admin/users/admin1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "admin1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when user does not exist", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await DetailDELETE(
      new Request("http://localhost:3000/api/admin/users/nonexistent", { method: "DELETE" }),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    expect(res.status).toBe(404);
  });

  it("deletes user successfully", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u2" } as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({ id: "u2" } as never);

    const res = await DetailDELETE(
      new Request("http://localhost:3000/api/admin/users/u2", { method: "DELETE" }),
      { params: Promise.resolve({ id: "u2" }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});