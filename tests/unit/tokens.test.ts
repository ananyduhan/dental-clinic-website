import { describe, it, expect } from "vitest";
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  VERIFICATION_TOKEN_TTL_MS,
  expiresAt,
  generateToken,
  hashToken,
} from "@/lib/tokens";

describe("generateToken", () => {
  it("returns 32 bytes as 64 hex characters", () => {
    const { raw } = generateToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateToken().raw));
    expect(seen.size).toBe(500);
  });

  it("returns a hash that matches hashToken(raw)", () => {
    const { raw, hash } = generateToken();
    expect(hash).toBe(hashToken(raw));
  });

  it("does not return the raw token as its own hash", () => {
    // The whole point: what lands in the database must not be a working link.
    const { raw, hash } = generateToken();
    expect(hash).not.toBe(raw);
  });
});

describe("hashToken", () => {
  it("is stable, so lookups match", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("differs for different inputs", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });

  it("produces a sha256 hex digest", () => {
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("expiries", () => {
  it("matches the windows in docs/security.md", () => {
    expect(VERIFICATION_TOKEN_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(PASSWORD_RESET_TOKEN_TTL_MS).toBe(30 * 60 * 1000);
  });

  it("adds the TTL to the supplied instant", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(expiresAt(PASSWORD_RESET_TOKEN_TTL_MS, now).toISOString()).toBe(
      "2026-01-01T00:30:00.000Z",
    );
  });
});
