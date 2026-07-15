/**
 * POST /api/admin/drive/connect
 * GET /api/admin/drive/connect
 *
 * Initiates the Google Drive OAuth2 flow or handles the callback.
 *
 * Flow:
 *   1. POST without code -> returns OAuth redirect URL
 *   2. GET with ?code=xxx -> exchanges code for tokens, stores in DB
 *
 * Admin-only access.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google Drive credentials not configured");
  }

  const appUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${appUrl}/api/admin/drive/connect`,
  );
}

/**
 * POST — Start the OAuth flow.
 * Returns the URL the admin should visit to authorize Drive access.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const oauth2Client = getOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent", // Force consent to get a new refresh token
    });

    return NextResponse.json({
      authUrl,
      message: "Visit this URL to authorize Google Drive access, then you'll be redirected back.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to start OAuth flow";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET — Handle the OAuth callback.
 * Google redirects here with ?code=xxx after the user authorizes.
 * We exchange the code for tokens and store the refresh token in the database.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/settings?drive_error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: "Missing authorization code" },
      { status: 400 },
    );
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        { error: "No refresh token received. Try revoking access and re-authorizing." },
        { status: 400 },
      );
    }

    // Store the refresh token and access token in the database
    // We use a simple key-value approach via the DriveFile model's settings
    // In a production app, we'd have a dedicated settings table, but for
    // this scope we store it in a simple config entry

    // Store encrypted refresh token in env or database
    // For now, we store it in the database as a special "settings" row
    // (In production, this should be encrypted at rest)

    // Update or create a settings record
    // We reuse the KnowledgeEntry table's tags field as a simple key-value store
    // This is a pragmatic approach for a single-tenant app

    // Actually, let's use a proper approach: store in the DriveFile table
    // as a special row with id "settings:drive"
    await prisma.driveFile.upsert({
      where: { id: "settings:drive" },
      create: {
        id: "settings:drive",
        name: `Google Drive Settings (connected by ${session.user.name})`,
        mimeType: "application/json",
        parentFolder: JSON.stringify({
          refreshToken: tokens.refresh_token,
          connectedBy: session.user.id,
          connectedAt: new Date().toISOString(),
        }),
      },
      update: {
        name: `Google Drive Settings (connected by ${session.user.name})`,
        mimeType: "application/json",
        parentFolder: JSON.stringify({
          refreshToken: tokens.refresh_token,
          connectedBy: session.user.id,
          connectedAt: new Date().toISOString(),
        }),
        lastSyncedAt: new Date(),
      },
    });

    // Redirect back to the admin settings page with a success message
    return NextResponse.redirect(
      new URL("/admin/settings?drive_connected=true", request.url),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth token exchange failed";
    return NextResponse.redirect(
      new URL(`/admin/settings?drive_error=${encodeURIComponent(msg)}`, request.url),
    );
  }
}