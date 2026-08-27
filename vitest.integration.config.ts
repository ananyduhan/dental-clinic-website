import { resolve } from "path";
import { defineConfig } from "vitest/config";

/**
 * Integration suites: real database, real transactions.
 *
 * Kept out of `pnpm test` so the unit run stays hermetic and fast. Run with
 * `pnpm test:integration`. Threads are NOT disabled — `booking.race.test.ts`
 * needs genuine concurrency to mean anything.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    // Transactions against a live database are slower than unit tests, and the
    // race suite deliberately contends.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // One file at a time: separate files share the same fixture rows.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
