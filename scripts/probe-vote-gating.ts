/** Isolates the anonymous upvote click. */
import { chromium, type Page } from "@playwright/test";

const WEB_URL = process.env.PH_WEB_URL || "https://www.producthunt.com";

async function settle(page: Page) {
  await page
    .waitForFunction(
      () => !document.title.includes("Just a moment") && !document.querySelector('input[name="cf-turnstile-response"]'),
      null,
      { timeout: 60_000 },
    )
    .catch(() => {});
}

const snapshot = (page: Page) =>
  page.evaluate(() => ({
    url: location.pathname,
    modalTestIds: [...document.querySelectorAll('[data-test*="modal" i], [data-test*="login" i], [data-test*="sign" i], [data-test*="auth" i]')]
      .map((el) => el.getAttribute("data-test")),
    alerts: [...document.querySelectorAll('[role="alert"]')].map((el) => (el.textContent ?? "").trim().slice(0, 120)).filter(Boolean),
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    signInWith: [...document.querySelectorAll("button, a")]
      .map((el) => (el.textContent ?? "").trim())
      .filter((text) => /sign in with|continue with|log in with/i.test(text)),
    overlayCount: document.querySelectorAll(".fixed.inset-0, [class*='overlay']").length,
  }));

async function attemptVote(page: Page, label: string, path: string) {
  console.log(`\n=== ${label} (${path}) ===`);
  await page.goto(`${WEB_URL}${path}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.getByTestId("dismiss-CookiePopup").click({ timeout: 6000 }).catch(() => {});

  const voteButtons = page.locator('[data-test="vote-button"]');
  const count = await voteButtons.count();
  console.log(`vote buttons: ${count}`);
  if (count === 0) return;

  const button = voteButtons.first();
  const before = (await button.innerText()).trim();
  console.log(`label before: "${before}"`);
  console.log(`before click: ${JSON.stringify(await snapshot(page))}`);

  await button.scrollIntoViewIfNeeded();
  await button.click({ timeout: 10_000 }).catch((error) => console.log(`click error: ${error.message.split("\n")[0]}`));

  // Poll instead of a single sleep so a short-lived prompt is not missed.
  for (const waitMs of [500, 1000, 2000, 4000, 8000]) {
    await page.waitForTimeout(waitMs === 500 ? 500 : 1000);
    console.log(`  +${waitMs}ms: label="${(await button.innerText().catch(() => "gone")).trim()}" ${JSON.stringify(await snapshot(page))}`);
  }
}

const browser = await chromium.launch({ headless: false, args: ["--disable-blink-features=AutomationControlled"] });
const page = await (await browser.newContext({ locale: "en-US" })).newPage();

await attemptVote(page, "homepage", "/");
await page.waitForTimeout(3000);
await attemptVote(page, "product page", "/products/notion");

await browser.close();
