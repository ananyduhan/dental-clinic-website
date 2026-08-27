import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load `.env` into `process.env` for integration runs.
 *
 * Vitest does not read `.env`, and these suites need `DATABASE_URL` and
 * `CLINIC_TIMEZONE`. Parsed by hand rather than adding a dotenv dependency for
 * one file. Existing environment variables always win, so CI can override.
 */
try {
  const contents = readFileSync(resolve(process.cwd(), ".env"), "utf8");

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
} catch {
  // No .env — the suites detect the missing DATABASE_URL and skip themselves.
}
