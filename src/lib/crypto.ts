/**
 * AES-256-GCM encryption / decryption helper for sensitive data at rest.
 *
 * Uses a key from the ENCRYPTION_KEY environment variable (32-byte hex or
 * UTF-8 string). If ENCRYPTION_KEY is not set, falls back to plaintext with
 * a console warning for backward compatibility.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV is recommended for GCM

function getEncryptionKey(): Buffer | null {
  const keyEnv = process.env.ENCRYPTION_KEY;
  if (!keyEnv) return null;

  // If the key looks like hex (64 chars = 32 bytes), decode it
  if (/^[0-9a-fA-F]{64}$/.test(keyEnv)) {
    return Buffer.from(keyEnv, "hex");
  }

  // Otherwise, derive a 32-byte key by hashing the string
  return crypto.createHash("sha256").update(keyEnv).digest();
}

/**
 * Encrypt a plaintext string. Returns a colon-delimited string:
 *   base64(iv):base64(authTag):base64(ciphertext)
 *
 * If ENCRYPTION_KEY is not set, returns the plaintext unchanged with a warning.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) {
    console.warn(
      "[crypto] ENCRYPTION_KEY not set — storing value in plaintext. Set ENCRYPTION_KEY for production.",
    );
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

/**
 * Decrypt a value produced by encrypt().
 *
 * If the value does not look encrypted (no colons), returns it as-is for
 * backward compatibility with previously stored plaintext values.
 *
 * @throws if ENCRYPTION_KEY is set but the value cannot be decrypted.
 */
export function decrypt(value: string): string {
  // Backward compat: if the value doesn't have the encrypted format, return as-is
  const parts = value.split(":");
  if (parts.length !== 3) {
    // Plaintext (legacy or ENCRYPTION_KEY was not set when stored)
    return value;
  }

  const key = getEncryptionKey();
  if (!key) {
    // ENCRYPTION_KEY not set now, but value appears encrypted — can't decrypt
    console.warn(
      "[crypto] ENCRYPTION_KEY not set but value appears encrypted — returning as-is (may fail).",
    );
    return value;
  }

  const [ivB64, authTagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Check whether encryption is currently active (ENCRYPTION_KEY is set).
 */
export function isEncryptionEnabled(): boolean {
  return getEncryptionKey() !== null;
}