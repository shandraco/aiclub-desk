import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against the production build (`next build && next start`), never the dev server:
 * the strict CSP, streaming and status codes only behave for real there.
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0, // flakes get fixed or quarantined, not retried (test-pyramid-that-matches-the-risk)
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? "pnpm start" : "pnpm build && pnpm start",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      PORT: String(PORT),
      SITE_URL: baseURL,
      LOG_LEVEL: "warn",
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://localhost:5432/aiclub_desk_e2e",
      // `next start` also loads .env.production.local if someone pulled production settings;
      // pin the Postgres fallbacks so tests can never pick up production credentials.
      PGHOST: "localhost",
      PGUSER: process.env.USER ?? "postgres",
      PGPASSWORD: "",
      PGDATABASE: "aiclub_desk_e2e",
      VERCEL_ENV: "development",
    },
  },
});
