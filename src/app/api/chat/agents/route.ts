/**
 * POST /api/chat/agents — Agent management via chat (requires admin session)
 *
 * This route lets Archie (the Hermes agent) manage agent profiles programmatically
 * when Jake asks via chat. All actions require admin authentication.
 *
 * The route reads/writes the AgentProfile table (local source of truth) and also
 * talks to the bridge on the VPS for real health checks and config updates:
 *   - health: pings the bridge health endpoint and reports real response time
 *   - update: writes model/provider changes to the VPS config.yaml via the bridge
 *   - list: enriches DB records with a lightweight bridge health probe per agent
 *
 * Actions:
 *   { action: "list" }
 *   { action: "update", agentId, model?, provider?, status? }
 *   { action: "health", agentId }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  bridgeGet,
  bridgePost,
  type BridgeHealthResponse,
  type BridgeConfigUpdateResponse,
} from "@/lib/bridge-client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return null;
  }
  return session;
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action as string | undefined;
  if (!action) {
    return NextResponse.json({ error: "Missing 'action' field" }, { status: 400 });
  }

  switch (action) {
    case "list":
      return handleList();
    case "update":
      return handleUpdate(body);
    case "health":
      return handleHealth(body);
    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );
  }
}

// --- Helpers ---

/**
 * Ping the bridge for a given profile and return a health snapshot.
 * Returns null (with optional error message) if the bridge is unreachable.
 */
async function probeBridgeHealth(profileKey: string): Promise<{
  ok: boolean;
  status: string;
  responseTimeMs: number;
  detail?: BridgeHealthResponse | null;
  error?: string;
}> {
  const start = Date.now();
  try {
    const data = await bridgeGet<BridgeHealthResponse>(
      `/api/health?profile=${encodeURIComponent(profileKey)}`,
    );
    return {
      ok: true,
      status: typeof data.status === "string" ? data.status : "online",
      responseTimeMs: Date.now() - start,
      detail: data,
    };
  } catch (err) {
    return {
      ok: false,
      status: "offline",
      responseTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// --- Action handlers ---

async function handleList() {
  const agents = await prisma.agentProfile.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  // Batch-fetch the roles for all agent roleKeys
  const roleKeys = [...new Set(agents.map((a) => a.roleKey))];
  const roles = await prisma.role.findMany({
    where: { key: { in: roleKeys } },
    select: { key: true, name: true, isAdmin: true },
  });
  const roleMap = new Map(roles.map((r) => [r.key, r]));

  // Probe bridge health for each agent concurrently. We use Promise.allSettled
  // so one slow/offline agent doesn't block the whole list.
  const healthResults = await Promise.allSettled(
    agents.map((a) => probeBridgeHealth(a.profileKey)),
  );

  const agentsWithRole = agents.map((a, idx) => {
    const role = roleMap.get(a.roleKey) ?? null;
    const healthResult = healthResults[idx];
    let bridgeHealth:
      | { ok: boolean; status: string; responseTimeMs: number; error?: string }
      | null = null;
    if (healthResult.status === "fulfilled") {
      bridgeHealth = {
        ok: healthResult.value.ok,
        status: healthResult.value.status,
        responseTimeMs: healthResult.value.responseTimeMs,
        error: healthResult.value.error,
      };
    } else {
      bridgeHealth = {
        ok: false,
        status: "offline",
        responseTimeMs: 0,
        error:
          healthResult.reason instanceof Error
            ? healthResult.reason.message
            : String(healthResult.reason),
      };
    }
    return { ...a, role, bridgeHealth };
  });

  return NextResponse.json({
    success: true,
    action: "list",
    agents: agentsWithRole,
  });
}

async function handleUpdate(body: Record<string, unknown>) {
  const agentId = body.agentId as string | undefined;
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const model = body.model as string | undefined;
  const provider = body.provider as string | undefined;
  const status = body.status as string | undefined;

  const existing = await prisma.agentProfile.findUnique({ where: { id: agentId } });
  if (!existing) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (model !== undefined) updateData.model = model || null;
  if (provider !== undefined) updateData.provider = provider || null;

  if (status) {
    const validStatuses = ["active", "inactive", "error"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 },
      );
    }
    updateData.status = status;
  }

  // Update the DB record first (local source of truth).
  const updated = await prisma.agentProfile.update({
    where: { id: agentId },
    data: updateData,
  });

  // Attempt to write model/provider changes to the VPS config.yaml via the bridge.
  // Only send the fields that are actually being changed.
  let bridgeError: string | undefined;
  let bridgeResponse: BridgeConfigUpdateResponse | undefined;
  if (model !== undefined || provider !== undefined) {
    const configPatch: Record<string, string> = {};
    if (model !== undefined && model) configPatch.model = model;
    if (provider !== undefined && provider) configPatch.provider = provider;

    if (Object.keys(configPatch).length > 0) {
      try {
        bridgeResponse = await bridgePost<BridgeConfigUpdateResponse>(
          `/api/profiles/${encodeURIComponent(existing.profileKey)}/config`,
          configPatch,
        );
      } catch (err) {
        bridgeError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  // Attach role info
  const role = await prisma.role.findUnique({
    where: { key: updated.roleKey },
    select: { key: true, name: true, isAdmin: true },
  });

  return NextResponse.json({
    success: true,
    action: "update",
    agent: { ...updated, role },
    bridgeAvailable: !bridgeError,
    bridgeError,
    bridgeResponse,
  });
}

async function handleHealth(body: Record<string, unknown>) {
  const agentId = body.agentId as string | undefined;
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const agent = await prisma.agentProfile.findUnique({ where: { id: agentId } });
  if (!agent) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  // Real health check via the bridge.
  const probe = await probeBridgeHealth(agent.profileKey);

  // Derive a DB-facing status from the probe result.
  let dbStatus = agent.status;
  if (probe.ok) {
    dbStatus = "active";
  } else if (agent.status !== "inactive") {
    // Only flip to error if the agent wasn't deliberately set inactive.
    dbStatus = "error";
  }

  // Persist the health-check timestamp + status.
  await prisma.agentProfile.update({
    where: { id: agentId },
    data: {
      lastHealthCheck: new Date(),
      status: dbStatus,
    },
  });

  return NextResponse.json({
    success: true,
    action: "health",
    agentId,
    profileKey: agent.profileKey,
    name: agent.name,
    status: probe.ok ? "online" : "offline",
    responseTime: probe.responseTimeMs,
    errorCount: probe.ok ? 0 : 1,
    bridgeDetail: probe.detail ?? null,
    bridgeError: probe.error,
    checkedAt: new Date().toISOString(),
  });
}