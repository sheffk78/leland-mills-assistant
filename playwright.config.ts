import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * Tests run against the live Railway deployment OR a local dev server.
 * Set BASE_URL env var to point tests at a specific environment.
 *
 * Usage:
 *   BASE_URL=https://leland-mills-assistant-production-1bdd.up.railway.app npx playwright test
 *   BASE_URL=http://localhost:3000 npx playwright test
 */
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // Sequential — login state can bleed between tests
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});