/**
 * POST /api/upload
 *
 * Accepts a multipart/form-data upload with a single "file" field.
 * Validates that the file is an image (jpeg, png, webp, gif) under 10 MB,
 * saves it to /public/uploads/ with a unique filename, and returns JSON
 * metadata about the stored file.
 *
 * Requires authentication (any role).
 */

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/lib/auth";
import { z } from "zod";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIMETYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

// Map mimetype to file extension
const MIMETYPE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const uploadResponseSchema = z.object({
  id: z.string(),
  filename: z.string(),
  url: z.string(),
  mimetype: z.string(),
  filesize: z.number(),
});

export async function POST(request: Request) {
  // Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data. Expected multipart/form-data." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' field in form data." },
      { status: 400 },
    );
  }

  // Validate mimetype
  if (!ALLOWED_MIMETYPES.includes(file.type as (typeof ALLOWED_MIMETYPES)[number])) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${file.type}. Allowed types: ${ALLOWED_MIMETYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum allowed: 10 MB.`,
      },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { error: "File is empty." },
      { status: 400 },
    );
  }

  // Generate a unique filename
  const ext = MIMETYPE_EXT[file.type] ?? "bin";
  const uniqueId = randomUUID();
  const uniqueFilename = `${uniqueId}.${ext}`;

  // Ensure the uploads directory exists
  const uploadsDir = join(process.cwd(), "public", "uploads");
  try {
    await mkdir(uploadsDir, { recursive: true });
  } catch {
    // Directory may already exist — ignore
  }

  // Write the file to disk
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filepath = join(uploadsDir, uniqueFilename);

  try {
    await writeFile(filepath, buffer);
  } catch {
    return NextResponse.json(
      { error: "Failed to save file to disk." },
      { status: 500 },
    );
  }

  const responseData = {
    id: uniqueId,
    filename: file.name,
    url: `/uploads/${uniqueFilename}`,
    mimetype: file.type,
    filesize: file.size,
  };

  // Validate response with Zod
  const parsed = uploadResponseSchema.safeParse(responseData);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Internal validation error." },
      { status: 500 },
    );
  }

  return NextResponse.json(parsed.data, { status: 200 });
}