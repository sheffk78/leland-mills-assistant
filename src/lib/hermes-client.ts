/**
 * Hermes Agent API client.
 *
 * This client communicates with Jake's Hermes agent instance (or the mock agent
 * during development). The base URL is configurable via HERMES_API_URL.
 *
 * In production, this will point to Jake's real Hermes agent endpoint.
 * In development, it defaults to http://localhost:3001 where the mock agent runs.
 */

const HERMES_BASE_URL =
  process.env.HERMES_API_URL ?? "http://localhost:3001";
const HERMES_API_KEY = process.env.HERMES_API_KEY ?? "";

export interface HermesChatRequest {
  message: string;
  conversationId?: string;
  history?: Array<{ role: string; content: string }>;
  role?: string; // "ADMIN" | "STAFF" | "DRIVER" — routes to the correct Hermes profile
}

export interface HermesChatResponse {
  response: string;
  conversationId: string;
  createdAt: string;
}

export interface HermesConversation {
  id: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
  }>;
}

export interface HermesHealth {
  status: string;
}

/**
 * Send a chat message to the Hermes agent and get a response.
 */
export async function sendChatMessage(
  request: HermesChatRequest,
): Promise<HermesChatResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (HERMES_API_KEY) {
    headers["X-API-Key"] = HERMES_API_KEY;
  }

  const res = await fetch(`${HERMES_BASE_URL}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(
      `Hermes agent returned ${res.status}: ${text}`,
    );
  }

  return (await res.json()) as HermesChatResponse;
}

/**
 * Retrieve conversation history from the Hermes agent.
 */
export async function getConversation(
  conversationId: string,
): Promise<HermesConversation> {
  const res = await fetch(
    `${HERMES_BASE_URL}/api/conversations/${conversationId}`,
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(
      `Hermes agent returned ${res.status}: ${text}`,
    );
  }

  return (await res.json()) as HermesConversation;
}

/**
 * Check if the Hermes agent is running and healthy.
 */
export async function checkHealth(): Promise<HermesHealth> {
  const headers: Record<string, string> = {};
  if (HERMES_API_KEY) {
    headers["X-API-Key"] = HERMES_API_KEY;
  }

  const res = await fetch(`${HERMES_BASE_URL}/api/health`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Hermes health check failed: ${res.status}`);
  }

  return (await res.json()) as HermesHealth;
}

/**
 * Get the configured Hermes base URL (for display in admin settings).
 */
export function getHermesBaseUrl(): string {
  return HERMES_BASE_URL;
}