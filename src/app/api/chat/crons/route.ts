/**
 * POST /api/chat/crons — Cron job management via chat (requires admin session)
 *
 * This route lets Archie (the Hermes agent) manage scheduled cron jobs
 * programmatically when Jake asks via chat. All actions require admin auth.
 *
 * The route is the source of truth for the *database* (CronJob table) and also
 * mirrors every mutation to the VPS Hermes instance through the bridge API
 * (http://localhost:8080). Reads fall back to the database when the bridge is
 * unreachable so the UI still works during bridge downtime.
 *
 * Actions:
 *   { action: "list" }
 *   { action: "create", name, prompt, schedule, skills[] }
 *   { action: "pause", jobId }
 *   { action: "resume", jobId }
 *   { action: "delete", jobId }
 *   { action: "update", jobId, name?, prompt?, schedule?, skills? }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  bridgeFetch,
  bridgeGet,
  bridgePost,
  bridgeDelete,
  type BridgeCronListResponse,
  type BridgeCronCreateResponse,
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
    case "create":
      return handleCreate(body);
    case "pause":
      return handlePause(body);
    case "resume":
      return handleResume(body);
    case "delete":
      return handleDelete(body);
    case "update":
      return handleUpdate(body);
    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );
  }
}

// --- Action handlers ---

async function handleList() {
  // Always read the DB first (local source of truth + works offline).
  const dbCrons = await prisma.cronJob.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Attempt to enrich with live state from the bridge. If the bridge is down,
  // return the DB records alone so the UI still renders.
  let bridgeError: string | undefined;
  let bridgeCrons: BridgeCronListResponse["crons"] = [];
  try {
    const bridgeData = await bridgeGet<BridgeCronListResponse>("/api/crons");
    bridgeCrons = bridgeData.crons ?? [];
  } catch (err) {
    bridgeError = err instanceof Error ? err.message : String(err);
  }

  // Merge: prefer the bridge's live isActive/lastRunAt/lastResult when we have
  // a matching job by name (Hermes cron jobs are keyed by name on the VPS).
  const bridgeByName = new Map(bridgeCrons.map((c) => [c.name, c]));
  const crons = dbCrons.map((db) => {
    const live = bridgeByName.get(db.name);
    if (!live) return db;
    return {
      ...db,
      isActive: live.isActive ?? db.isActive,
      lastRunAt: live.lastRunAt ? new Date(live.lastRunAt) : db.lastRunAt,
      lastResult: live.lastResult ?? db.lastResult,
      bridgeId: live.id,
    };
  });

  return NextResponse.json({
    success: true,
    action: "list",
    crons,
    bridgeAvailable: !bridgeError,
    bridgeError,
  });
}

async function handleCreate(body: Record<string, unknown>) {
  const name = body.name as string | undefined;
  const prompt = body.prompt as string | undefined;
  const schedule = body.schedule as string | undefined;
  const skills = (body.skills as string[] | undefined) ?? [];

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!schedule || typeof schedule !== "string") {
    return NextResponse.json({ error: "schedule is required (cron expression)" }, { status: 400 });
  }

  // Basic validation that schedule looks like a cron expression (5 fields)
  const cronFields = schedule.trim().split(/\s+/);
  if (cronFields.length < 5 || cronFields.length > 6) {
    return NextResponse.json(
      { error: "schedule must be a valid cron expression (e.g. '0 9 * * 1' for every Monday at 9am)" },
      { status: 400 },
    );
  }

  // 1. Create the real Hermes cron job on the VPS via the bridge.
  let bridgeError: string | undefined;
  let bridgeCronId: string | undefined;
  try {
    const bridgeData = await bridgePost<BridgeCronCreateResponse>("/api/crons", {
      name,
      prompt,
      schedule,
      skills,
    });
    bridgeCronId = bridgeData.cron?.id;
  } catch (err) {
    bridgeError = err instanceof Error ? err.message : String(err);
    // Surface the error but still persist locally so the operator can retry.
  }

  // 2. Persist metadata to the DB for local tracking.
  const cron = await prisma.cronJob.create({
    data: {
      name,
      prompt,
      schedule,
      skills,
      isActive: true,
    },
  });

  return NextResponse.json(
    {
      success: true,
      action: "create",
      cron,
      bridgeCronId,
      bridgeAvailable: !bridgeError,
      bridgeError,
    },
    { status: 201 },
  );
}

async function handlePause(body: Record<string, unknown>) {
  const jobId = body.jobId as string | undefined;
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const existing = await prisma.cronJob.findUnique({ where: { id: jobId } });
  if (!existing) {
    return NextResponse.json({ error: "Cron job not found" }, { status: 404 });
  }

  // Pause on the VPS first.
  let bridgeError: string | undefined;
  try {
    await bridgePost(`/api/crons/${encodeURIComponent(jobId)}/pause`);
  } catch (err) {
    bridgeError = err instanceof Error ? err.message : String(err);
  }

  const cron = await prisma.cronJob.update({
    where: { id: jobId },
    data: { isActive: false },
  });

  return NextResponse.json({
    success: true,
    action: "pause",
    cron,
    bridgeAvailable: !bridgeError,
    bridgeError,
  });
}

async function handleResume(body: Record<string, unknown>) {
  const jobId = body.jobId as string | undefined;
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const existing = await prisma.cronJob.findUnique({ where: { id: jobId } });
  if (!existing) {
    return NextResponse.json({ error: "Cron job not found" }, { status: 404 });
  }

  // Resume on the VPS first.
  let bridgeError: string | undefined;
  try {
    await bridgePost(`/api/crons/${encodeURIComponent(jobId)}/resume`);
  } catch (err) {
    bridgeError = err instanceof Error ? err.message : String(err);
  }

  const cron = await prisma.cronJob.update({
    where: { id: jobId },
    data: { isActive: true },
  });

  return NextResponse.json({
    success: true,
    action: "resume",
    cron,
    bridgeAvailable: !bridgeError,
    bridgeError,
  });
}

async function handleDelete(body: Record<string, unknown>) {
  const jobId = body.jobId as string | undefined;
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const existing = await prisma.cronJob.findUnique({ where: { id: jobId } });
  if (!existing) {
    return NextResponse.json({ error: "Cron job not found" }, { status: 404 });
  }

  // Delete on the VPS first.
  let bridgeError: string | undefined;
  try {
    await bridgeDelete(`/api/crons/${encodeURIComponent(jobId)}`);
  } catch (err) {
    bridgeError = err instanceof Error ? err.message : String(err);
  }

  await prisma.cronJob.delete({ where: { id: jobId } });

  return NextResponse.json({
    success: true,
    action: "delete",
    jobId,
    bridgeAvailable: !bridgeError,
    bridgeError,
  });
}

async function handleUpdate(body: Record<string, unknown>) {
  const jobId = body.jobId as string | undefined;
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const existing = await prisma.cronJob.findUnique({ where: { id: jobId } });
  if (!existing) {
    return NextResponse.json({ error: "Cron job not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  const name = body.name as string | undefined;
  if (name !== undefined) updateData.name = name;

  const prompt = body.prompt as string | undefined;
  if (prompt !== undefined) updateData.prompt = prompt;

  const schedule = body.schedule as string | undefined;
  if (schedule !== undefined) {
    const cronFields = schedule.trim().split(/\s+/);
    if (cronFields.length < 5 || cronFields.length > 6) {
      return NextResponse.json(
        { error: "schedule must be a valid cron expression (e.g. '0 9 * * 1' for every Monday at 9am)" },
        { status: 400 },
      );
    }
    updateData.schedule = schedule;
  }

  const skills = body.skills as string[] | undefined;
  if (skills !== undefined) updateData.skills = skills;

  // Mirror the update to the bridge (PUT /api/crons/:id).
  let bridgeError: string | undefined;
  try {
    await bridgeFetchBridgeUpdate(jobId, updateData);
  } catch (err) {
    bridgeError = err instanceof Error ? err.message : String(err);
  }

  const cron = await prisma.cronJob.update({
    where: { id: jobId },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    action: "update",
    cron,
    bridgeAvailable: !bridgeError,
    bridgeError,
  });
}

async function bridgeFetchBridgeUpdate(jobId: string, updateData: Record<string, unknown>) {
  await bridgeFetch(`/api/crons/${encodeURIComponent(jobId)}`, {
    method: "PUT",
    body: JSON.stringify(updateData),
  });
}