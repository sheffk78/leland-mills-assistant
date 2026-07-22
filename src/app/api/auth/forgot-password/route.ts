/**
 * POST /api/auth/forgot-password
 *
 * Generates a password reset token for the given email.
 * Since Leland Mills doesn't have outbound email yet, the reset link
 * is returned in the response body (admin can copy/send to the user).
 * In production, this would email the link via Postmark/Resend.
 */

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Look up user — always return success to prevent email enumeration
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    // Don't reveal that the email doesn't exist
    return NextResponse.json({ success: true });
  }

  // Generate a secure random token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Invalidate any existing tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Create new token
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  // Build the reset link
  const origin = request.headers.get("origin") ?? "https://archie.lelandmills.com";
  const resetLink = `${origin}/reset-password?token=${token}`;

  // In production, send email here. For now, return the link.
  return NextResponse.json({ success: true, resetLink });
}