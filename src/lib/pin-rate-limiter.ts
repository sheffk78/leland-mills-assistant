/**
 * Simple in-memory rate limiter for PIN login attempts.
 *
 * Tracks failed attempts per IP address. After MAX_ATTEMPTS failures within
 * the WINDOW_MS time window, further attempts are rejected until the window
 * expires. Successful logins reset the counter for that IP.
 *
 * No external dependencies — uses a plain Map. State is lost on server restart
 * (acceptable for a single-instance VPS deployment).
 */

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

const attempts = new Map<string, AttemptRecord>();

/**
 * Check if an IP is currently locked out.
 * Returns the number of minutes remaining if locked out, or null if not locked.
 */
export function checkRateLimit(ip: string): { locked: boolean; minutesRemaining: number } {
  const record = attempts.get(ip);
  const now = Date.now();

  if (!record) {
    return { locked: false, minutesRemaining: 0 };
  }

  // Check if lockout has expired
  if (record.lockedUntil && now >= record.lockedUntil) {
    attempts.delete(ip);
    return { locked: false, minutesRemaining: 0 };
  }

  // Check if the attempt window has expired (reset)
  if (now - record.firstAttemptAt > WINDOW_MS && !record.lockedUntil) {
    attempts.delete(ip);
    return { locked: false, minutesRemaining: 0 };
  }

  if (record.lockedUntil) {
    const msRemaining = record.lockedUntil - now;
    const minutesRemaining = Math.ceil(msRemaining / 60000);
    return { locked: true, minutesRemaining };
  }

  return { locked: false, minutesRemaining: 0 };
}

/**
 * Record a failed PIN attempt for the given IP.
 * If this pushes the count over MAX_ATTEMPTS, the IP is locked out.
 */
export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  let record = attempts.get(ip);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    record = { count: 0, firstAttemptAt: now, lockedUntil: null };
  }

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS && !record.lockedUntil) {
    record.lockedUntil = now + LOCKOUT_MS;
  }

  attempts.set(ip, record);
}

/**
 * Reset the attempt counter for an IP (call on successful login).
 */
export function resetAttempts(ip: string): void {
  attempts.delete(ip);
}

/**
 * Extract a client IP from a NextRequest or similar Request object.
 * Falls back to "unknown" if no IP headers are present.
 */
export function getClientIp(request: Request): string {
  // Next.js may populate x-forwarded-for or x-real-ip
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}