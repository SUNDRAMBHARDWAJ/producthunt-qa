import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { test as setup } from "@playwright/test";
import { dismissCookieBanner, waitForAppShell } from "../../src/web/challenge";
import { AUTH_STATE, CLEARANCE_STATE } from "../../src/web/clearance";

setup("clear bot protection once and cache the session", async ({ page, context }) => {
  setup.setTimeout(300_000);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForAppShell(page, 240_000);
  await dismissCookieBanner(page);

  mkdirSync(dirname(CLEARANCE_STATE), { recursive: true });
  await context.storageState({ path: CLEARANCE_STATE });
  await context.storageState({ path: AUTH_STATE });
});
