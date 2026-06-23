/**
 * Google Drive API client.
 *
 * Provides search and read functions for files in the Leland Mills Google Drive.
 * Used to let the assistant look up delivery notes, inspection reports, feed
 * formulas, maintenance records, etc.
 *
 * TODO: Jake needs to set up OAuth credentials in Google Cloud Console.
 *   1. Create a project at https://console.cloud.google.com/
 *   2. Enable the Google Drive API
 *   3. Create OAuth 2.0 credentials (type: Web application)
 *   4. Set authorized redirect URIs
 *   5. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env
 *
 * For now, these functions use a service-account-style approach with a
 * pre-configured JWT client. The actual OAuth flow for per-user access
 * still needs to be implemented (see TODO in getAuthClient).
 */

import { google, type drive_v3 } from "googleapis";

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
 * Get an authenticated Google Drive client.
 *
 * TODO: Implement the full OAuth2 flow for per-user authentication.
 * Currently uses a service account approach which requires a service account
 * JSON key file. For production, this should use OAuth2 with stored tokens
 * per user (stored in the database or a session).
 */
function getDriveClient(): drive_v3.Drive {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Drive credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
    );
  }

  // TODO: Replace with proper OAuth2 flow with stored refresh tokens.
  // For now, this creates a JWT client that expects a service account key.
  // In production, Jake will either:
  //   a) Use a service account with domain-wide delegation, or
  //   b) Implement per-user OAuth2 with token storage
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
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
  const drive = getDriveClient();
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
  const drive = getDriveClient();

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
  const drive = getDriveClient();
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