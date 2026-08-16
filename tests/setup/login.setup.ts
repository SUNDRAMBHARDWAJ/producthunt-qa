import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { test as setup } from "@playwright/test";
import { config, hasGoogleLogin } from "../../src/config/env";
import { dismissOverlays, waitForAppShell } from "../../src/web/challenge";
import { AUTH_STATE, CLEARANCE_STATE } from "../../src/web/clearance";
import { completeGoogleSignIn } from "../../src/web/google-sso";
import { LoginModal } from "../../src/web/pages/login-modal";

// Optional. Missing/failed Google login fails this one test; the rest still run logged out.
setup("sign in with Google before E2E", async ({ page, context }) => {
  setup.setTimeout(180_000);

  mkdirSync(dirname(AUTH_STATE), { recursive: true });

  if (!hasGoogleLogin) {
    copyFileSync(CLEARANCE_STATE, AUTH_STATE);
    throw new Error(
      "Google login was not run: PH_GOOGLE_EMAIL and/or PH_GOOGLE_PASSWORD are missing. " +
        "Copy .env.example to .env and fill them in if you want a signed-in session. " +
        "The rest of the E2E suite still runs logged out.",
    );
  }

  page.on("dialog", (dialog) => {
    void dialog.dismiss().catch(() => {});
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForAppShell(page, 120_000);
  await dismissOverlays(page);

  const alreadyIn = await page.getByTestId("header-nav-link-sign-in").isHidden().catch(() => false);
  if (alreadyIn) {
    await dismissOverlays(page);
    await context.storageState({ path: AUTH_STATE });
    return;
  }

  const loginModal = new LoginModal(page);
  await page.getByTestId("header-nav-link-sign-in").click();
  await loginModal.container.waitFor({ state: "visible", timeout: 15_000 });
  await dismissOverlays(page, { keepLoginModal: true });

  const popupPromise = page.waitForEvent("popup", { timeout: 10_000 }).catch(() => null);
  await loginModal.provider("google").click();
  const googlePage = (await popupPromise) ?? page;

  try {
    await completeGoogleSignIn(googlePage, config.googleEmail, config.googlePassword);

    if (page.isClosed()) {
      throw new Error("Google sign-in closed the browser window.");
    }

    await page.waitForURL(/producthunt\.com/, { timeout: 90_000 });
    await waitForAppShell(page, 60_000);
    await page.getByTestId("header-nav-link-sign-in").waitFor({ state: "hidden", timeout: 60_000 });
    await dismissOverlays(page);
    await context.storageState({ path: AUTH_STATE });
  } catch (error) {
    copyFileSync(CLEARANCE_STATE, AUTH_STATE);
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw new Error(`${reason} Remaining E2E tests still run logged out.`);
  }
});
