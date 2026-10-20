import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, E2E_PORT, e2eEnv } from "./tests/e2e/env";

/**
 * End-to-end tests against a production build, with its own database, bucket, and queue (see tests/e2e/env.ts).
 * Needs the docker compose services running. Uses the installed Google Chrome; set E2E_SKIP_BUILD=1 to reuse
 * the last `next build`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "Asia/Kolkata",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    // The standalone server, as in the Docker image (it needs the static files copied next to it).
    command: [
      process.env.E2E_SKIP_BUILD ? null : "npm run build",
      "mkdir -p .next/standalone/.next/static .next/standalone/public",
      "cp -r .next/static/. .next/standalone/.next/static/",
      "cp -r public/. .next/standalone/public/",
      `PORT=${E2E_PORT} HOSTNAME=localhost node .next/standalone/server.js`,
    ]
      .filter(Boolean)
      .join(" && "),
    url: `${BASE_URL}/sign-in`,
    env: e2eEnv() as Record<string, string>,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
