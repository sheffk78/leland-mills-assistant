/**
 * Bridge API client.
 *
 * The bridge runs on the same VPS as the Next.js app and proxies requests to the
 * Hermes CLI / config on the VPS filesystem. Both services share localhost, so
 * the default BRIDGE_URL is http://localhost:8080.
 *
 * All bridge endpoints require an X-API-Key header for authentication.
 */

const BRIDGE_URL = process.env.BRIDGE_URL || "http://localhost:8080";
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY || "REMOVED";

export interface BridgeResponse {
  [key: string]: unknown;
}

/**
 * Low-level fetch wrapper for the bridge API. Adds the X-API-Key header and
 * JSON content type automatically. Throws on non-2xx responses.
 */
export async function bridgeFetch<T = BridgeResponse>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": BRIDGE_API_KEY,
      ...options.headers,
    },
    // Generous timeout — cron list / config writes can be slow on the VPS.
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Bridge API error ${res.status}: ${text}`);
  }

  // Some endpoints (DELETE) may return empty bodies; guard against that.
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return {} as T;
}

/** GET helper. */
export function bridgeGet<T = BridgeResponse>(path: string): Promise<T> {
  return bridgeFetch<T>(path, { method: "GET" });
}

/** POST helper with a JSON body. */
export function bridgePost<T = BridgeResponse>(
  path: string,
  body?: unknown,
): Promise<T> {
  return bridgeFetch<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** DELETE helper. */
export function bridgeDelete<T = BridgeResponse>(path: string): Promise<T> {
  return bridgeFetch<T>(path, { method: "DELETE" });
}

/** Expose the configured bridge URL for diagnostics / display. */
export function getBridgeUrl(): string {
  return BRIDGE_URL;
}

// ---------------------------------------------------------------------------
// Typed response shapes for the endpoints we call
// ---------------------------------------------------------------------------

export interface BridgeCronJob {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  skills?: string[];
  isActive?: boolean;
  lastRunAt?: string | null;
  lastResult?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BridgeCronListResponse {
  success: boolean;
  crons: BridgeCronJob[];
}

export interface BridgeCronCreateResponse {
  success: boolean;
  cron: BridgeCronJob;
}

export interface BridgeHealthResponse {
  status: string;
  uptime?: number;
  version?: string;
  model?: string;
  provider?: string;
  profile?: string;
  responseTimeMs?: number;
}

export interface BridgeConfigUpdateResponse {
  success: boolean;
  profile: string;
  updated: Record<string, unknown>;
}