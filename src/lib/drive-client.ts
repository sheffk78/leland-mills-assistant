/**
 * Google Drive API client.
 *
 * Provides search and read functions for files in the Leland Mills Google Drive.
 * Used to let the assistant look up delivery notes, inspection reports, feed
 * formulas, maintenance records, etc.
 *
 * Authentication uses OAuth2 with stored refresh tokens.
 * The admin connects Drive via /api/admin/drive/connect (OAuth flow).
 * The refresh token is stored in the database and used to get fresh access tokens.
 */

import { google, type drive_v3 } from "googleapis";
import { prisma } from "@/lib/db";

export interface DriveSearchResult {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
}

export interface DriveFileContent {
  id: string;
  name: string;
  mimeType: string;
  content: string;
  webViewLink?: string;
}

/**
 * Get the stored refresh token from the database.
 * Returns null if Drive hasn't been connected yet.
 */
async function getStoredRefreshToken(): Promise<string | null> {
  const settings = await prisma.driveFile.findUnique({
    where: { id: "settings:drive" },
  });

  if (!settings?.parentFolder) {
    return null;
  }

  try {
    const data = JSON.parse(settings.parentFolder);
    return data.refreshToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Get an authenticated Google Drive client.
 *
 * Uses the stored OAuth2 refresh token to get a fresh access token.
 * Falls back to service account credentials if set (alternative auth method).
 *
 * @throws if Drive credentials are not configured at all
 */
async function getDriveClient(): Promise<drive_v3.Drive> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Drive credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
    );
  }

  const appUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  // Try OAuth2 with stored refresh token first
  const refreshToken = await getStoredRefreshToken();

  if (refreshToken) {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${appUrl}/api/admin/drive/connect`,
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // The Google APIs library auto-refreshes the access token when it expires
    return google.drive({ version: "v3", auth: oauth2Client });
  }

  // Fallback: service account approach (if configured)
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (serviceAccountEmail && serviceAccountKey) {
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: serviceAccountKey,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    return google.drive({ version: "v3", auth });
  }

  throw new Error(
    "Google Drive is not connected. An admin needs to authorize Drive access via the settings page.",
  );
}

/**
 * Search for files in the Leland Mills Google Drive.
 *
 * @param query - Search query (matches file names and content)
 * @param maxResults - Maximum number of results (default 10)
 */
export async function searchDriveFiles(
  query: string,
  maxResults = 10,
): Promise<DriveSearchResult[]> {
  const drive = await getDriveClient();
  const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID ?? "root";

  // Build a Drive query: search in the root folder and subfolders
  const driveQuery = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`;

  const res = await drive.files.list({
    q: driveQuery,
    pageSize: maxResults,
    fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
    orderBy: "modifiedTime desc",
    ...(rootFolderId !== "root" ? { corpora: "user" } : {}),
  });

  return (res.data.files ?? []).map((file) => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    modifiedTime: file.modifiedTime!,
    webViewLink: file.webViewLink ?? undefined,
  }));
}

/**
 * Read the content of a specific Google Drive file.
 *
 * For text-based files, returns the extracted text content.
 * For binary files (PDFs, images), returns metadata with a view link.
 */
export async function readDriveFile(
  fileId: string,
): Promise<DriveFileContent> {
  const drive = await getDriveClient();

  // Get file metadata
  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, webViewLink",
  });

  // For Google Docs/Sheets/etc, export as text
  const mimeType = meta.data.mimeType ?? "";
  let content = "";

  if (mimeType === "application/vnd.google-apps.document") {
    const exportRes = await drive.files.export({
      fileId,
      mimeType: "text/plain",
    });
    content = String(exportRes.data);
  } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
    const exportRes = await drive.files.export({
      fileId,
      mimeType: "text/csv",
    });
    content = String(exportRes.data);
  } else if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json"
  ) {
    const mediaRes = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" },
    );
    content = String(mediaRes.data);
  } else {
    content = `[Binary file: ${mimeType}. View in Google Drive.]`;
  }

  return {
    id: meta.data.id!,
    name: meta.data.name!,
    mimeType,
    content,
    webViewLink: meta.data.webViewLink ?? undefined,
  };
}

/**
 * List files in a specific Drive folder.
 */
export async function listDriveFiles(
  folderId?: string,
  maxResults = 50,
): Promise<DriveSearchResult[]> {
  const drive = await getDriveClient();
  const parent = folderId ?? process.env.DRIVE_ROOT_FOLDER_ID ?? "root";

  const res = await drive.files.list({
    q: `'${parent}' in parents and trashed = false`,
    pageSize: maxResults,
    fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
    orderBy: "name",
  });

  return (res.data.files ?? []).map((file) => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    modifiedTime: file.modifiedTime!,
    webViewLink: file.webViewLink ?? undefined,
  }));
}

/**
 * Check if Google Drive has been connected (refresh token exists in DB).
 */
export async function isDriveConnected(): Promise<boolean> {
  const token = await getStoredRefreshToken();
  return token !== null;
}