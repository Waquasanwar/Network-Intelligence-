import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the production build in demo mode (no Notion token needed).
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3101", timezoneId: "Europe/London", trace: "off", contextOptions: { reducedMotion: "reduce" } },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", browserName: "chromium" }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: "next start -p 3101",
    url: "http://localhost:3101/api/cron/weekly-brief",
    reuseExistingServer: false,
    env: { CRON_SECRET: "test-cron", CAPTURE_TOKEN: "test-token", JOURNAL_TIMEZONE: "Europe/London", NOTION_TOKEN: "", APP_PASSCODE: "" },
    timeout: 60_000,
  },
});
