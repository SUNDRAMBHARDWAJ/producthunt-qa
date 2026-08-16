import { defineConfig, devices } from "@playwright/test";
import { config } from "./src/config/env";
import { AUTH_STATE, CLEARANCE_STATE } from "./src/web/clearance";

// Cloudflare blocks headless. Headed Chrome is the run that works.
const headless = process.env.PH_HEADLESS === "true";
const channel = process.env.PH_BROWSER_CHANNEL ?? "chrome";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "reports/e2e.json" }],
    ...(process.env.CI ? [["github"] as const] : []),
  ],
  use: {
    baseURL: config.webUrl,
    headless,
    launchOptions: {
      args: ["--disable-blink-features=AutomationControlled"],
    },
    testIdAttribute: "data-test",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "en-US",
    timezoneId: "UTC",
  },
  projects: [
    {
      name: "setup",
      testDir: "./tests/setup",
      testMatch: /clearance\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], channel },
    },
    {
      name: "login",
      dependencies: ["setup"],
      testDir: "./tests/setup",
      testMatch: /login\.setup\.ts/,
      retries: 0,
      use: { ...devices["Desktop Chrome"], channel, storageState: CLEARANCE_STATE },
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /auth-gating\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel, storageState: AUTH_STATE },
    },
    {
      name: "anonymous",
      dependencies: ["setup"],
      testMatch: /auth-gating\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel, storageState: CLEARANCE_STATE },
    },
  ],
});
