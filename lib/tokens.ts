import { createHash, randomBytes } from "crypto";

/**
 * Single-use token generation for email verification and password reset.
 *
 * The raw token goes in the email; only its SHA-256 hash is stored. A leaked
 * database backup therefore does not hand over working reset links — an
 * attacker would have to invert the hash to produce a token the lookup accepts.
 * See docs/security.md: "stored as a hash in the DB".
 *
 * SHA-256 rather than bcrypt is correct here: these tokens are 32 bytes of CSPRNG
 * output, so there is no dictionary to attack and no need for a slow KDF. The
 * slowness of bcrypt buys nothing against 256 bits of entropy and would make
 * every verification click measurably slower.
 *
 * Lookup is by hash, which is an indexed equality match inside Postgres — there
 * is no application-level comparison of secrets to leak timing information.
 */

/** Bytes of entropy per token. docs/security.md specifies 32. */
const TOKEN_BYTES = 32;

export interface GeneratedToken {
  /** Goes in the email link. Never stored, never logged. */
  raw: string;
  /** Goes in the database. */
  hash: string;
}

export function generateToken(): GeneratedToken {
  const raw = randomBytes(TOKEN_BYTES).toString("hex");
  return { raw, hash: hashToken(raw) };
}

/** Hash a raw token for storage or lookup. Stable, so lookups match. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Expiry windows, per docs/security.md. */
export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000; //     30 minutes

export function expiresAt(ttlMs: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + ttlMs);
}
