import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a production build, with Notion replaced by an in-memory mock
 * (e2e/support/mock-notion.mjs). No real Notion, LinkedIn or Anthropic calls are made.
 *
 *   npm run e2e            build, start, run everything
 *   npm run e2e -- --ui    interactive
 */
const APP_PORT = 3101;
const MOCK_PORT = 4998;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // one shared mock database
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/support/global-setup.ts",
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
  webServer: [
    {
      command: `node e2e/support/mock-notion.mjs`,
      env: { MOCK_NOTION_PORT: String(MOCK_PORT) },
      url: `http://127.0.0.1:${MOCK_PORT}/__reset`,
      reuseExistingServer: false,
    },
    {
      command: `npx next build && npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/connect`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: {
        NOTION_TOKEN: "test",
        NOTION_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        NOTION_POSTS_DS: "posts",
        NOTION_SNAPSHOTS_DS: "snaps",
        NOTION_DAILY_DS: "daily",
        NOTION_SWIPE_DS: "swipe",
        NOTION_CONFIG_DS: "config",
        NOTION_CONNECTIONS_DS: "people",
        NOTION_AUDIENCE_DS: "audience",
        APP_URL: `http://localhost:${APP_PORT}`,
        APP_PASSWORD: "",
        ANTHROPIC_API_KEY: "",
      },
    },
  ],
});
