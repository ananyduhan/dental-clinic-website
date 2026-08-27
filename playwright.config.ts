import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 *
 * These drive a real browser against a real server and a real database, so they
 * are deliberately separate from `pnpm test` (hermetic units) and
 * `pnpm test:integration` (database, no browser). Run with `pnpm e2e`.
 *
 * Browsers are not vendored — run `npx playwright install chromium` once.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // The suites book real appointments against shared seed data; running them in
  // parallel would have them competing for the same slots.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // Production build: closer to what actually ships, and avoids the dev
    // server's on-demand compilation making the first navigation time out.
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
