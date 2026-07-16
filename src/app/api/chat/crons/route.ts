/**
 * POST /api/chat/crons — Cron job management via chat (requires admin session)
 *
 * This route lets Archie (the Hermes agent) manage scheduled cron jobs
 * programmatically when Jake asks via chat. All actions require admin auth.
 *
 * Actions:
 *   { action: "list" }
 *   { action: "create", name, prompt, schedule, skills[] }
 *   { action: "pause", jobId }
 *   { action: "resume", jobId }
 *   { action: "delete", jobId }
 *   { action: "update", jobId, name?, prompt?, schedule?, skills? }
 *
 * Cron job metadata is stored in the database (CronJob model). The actual
 * cron execution happens on the VPS via Hermes cron — this route manages
 * the metadata that gets synced to the VPS filesystem.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
  const crons = await prisma.cronJob.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    success: true,
    action: "list",
    crons,
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

  const cron = await prisma.cronJob.update({
    where: { id: jobId },
    data: { isActive: false },
  });

  return NextResponse.json({
    success: true,
    action: "pause",
    cron,
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

  const cron = await prisma.cronJob.update({
    where: { id: jobId },
    data: { isActive: true },
  });

  return NextResponse.json({
    success: true,
    action: "resume",
    cron,
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

  await prisma.cronJob.delete({ where: { id: jobId } });

  return NextResponse.json({
    success: true,
    action: "delete",
    jobId,
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

  const cron = await prisma.cronJob.update({
    where: { id: jobId },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    action: "update",
    cron,
  });
}