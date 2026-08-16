/** Compares goto vs persistent profile vs click navigation under Cloudflare. */
import { chromium, type Page } from "@playwright/test";
import { rmSync } from "node:fs";

const WEB_URL = process.env.PH_WEB_URL || "https://www.producthunt.com";
const PROFILE_DIR = ".playwright-profile-probe";

const isChallenged = async (page: Page) => (await page.title()).includes("Just a moment");

async function settle(page: Page, timeout = 45_000) {
  await page
    .waitForFunction(() => !document.title.includes("Just a moment") && !!document.querySelector("main"), null, {
      timeout,
    })
    .catch(() => {});
}

async function strategyFreshContextGoto() {
  console.log("\n=== 1. page.goto in a fresh context ===");
  const browser = await chromium.launch({ headless: false, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await (await browser.newContext({ locale: "en-US" })).newPage();

  for (const path of ["/", "/topics/artificial-intelligence", "/leaderboard/daily/2026/8/14"]) {
    await page.goto(`${WEB_URL}${path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await settle(page);
    console.log(`  ${path} -> challenged: ${await isChallenged(page)} | title: ${(await page.title()).slice(0, 50)}`);
    await page.waitForTimeout(3000);
  }
  await browser.close();
}

async function strategyPersistentProfileGoto() {
  console.log("\n=== 2. page.goto in a persistent profile ===");
  rmSync(PROFILE_DIR, { recursive: true, force: true });

  for (const pass of [1, 2]) {
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      locale: "en-US",
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const page = context.pages()[0] ?? (await context.newPage());

    for (const path of ["/", "/topics/artificial-intelligence"]) {
      await page.goto(`${WEB_URL}${path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
      await settle(page);
      console.log(`  pass ${pass} ${path} -> challenged: ${await isChallenged(page)} | title: ${(await page.title()).slice(0, 50)}`);
      await page.waitForTimeout(3000);
    }
    await context.close();
  }
  rmSync(PROFILE_DIR, { recursive: true, force: true });
}

async function strategyClientSideNavigation() {
  console.log("\n=== 3. client-side navigation by clicking ===");
  const browser = await chromium.launch({ headless: false, args: ["--disable-blink-features=AutomationControlled"] });
  const page = await (await browser.newContext({ locale: "en-US" })).newPage();

  await page.goto(WEB_URL, { waitUntil: "domcontentloaded" });
  await settle(page);
  console.log(`  homepage -> challenged: ${await isChallenged(page)}`);
  await page.locator('[data-test="dismiss-CookiePopup"]').click({ timeout: 5000 }).catch(() => {});

  // Search via the header input (client-side route change).
  await page.locator('[data-test="header-search-input"]').fill("notion");
  await page.locator('[data-test="header-search-input"]').press("Enter");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(5000);
  console.log(`  after search -> url: ${page.url()}`);
  console.log(`  after search -> challenged: ${await isChallenged(page)} | title: ${(await page.title()).slice(0, 60)}`);
  console.log(`  search hooks: ${JSON.stringify(await hooksOf(page)).slice(0, 700)}`);
  console.log(`  h1/h2: ${JSON.stringify(await headingsOf(page))}`);

  // Back to the homepage, then into a product page by clicking.
  await page.goBack().catch(() => {});
  await page.waitForTimeout(3000);
  const productLink = page.locator('a[href^="/products/"]').first();
  const href = await productLink.getAttribute("href").catch(() => null);
  await productLink.click({ timeout: 10_000 }).catch((e) => console.log(`  product click failed: ${e.message.split("\n")[0]}`));
  await page.waitForTimeout(6000);
  console.log(`  clicked product ${href} -> url: ${page.url()}`);
  console.log(`  product page challenged: ${await isChallenged(page)} | title: ${(await page.title()).slice(0, 60)}`);
  console.log(`  product hooks: ${JSON.stringify(await hooksOf(page)).slice(0, 900)}`);
  console.log(`  product h1/h2: ${JSON.stringify(await headingsOf(page))}`);

  // Anonymous vote attempt.
  const vote = page.locator('[data-test="vote-button"]').first();
  if ((await vote.count()) > 0) {
    await vote.click().catch(() => {});
    await page.waitForTimeout(4000);
    console.log(
      `  after vote click -> url: ${page.url()} dialogs: ${await page.locator('[role="dialog"]').count()} mentionsSignIn: ${await page.evaluate(() => /sign in|log in|continue with/i.test(document.body.innerText.slice(0, 5000)))}`,
    );
  }

  await browser.close();
}

const hooksOf = (page: Page) =>
  page.evaluate(() => {
    const counts: Record<string, number> = {};
    for (const el of document.querySelectorAll("[data-test]")) {
      const key = (el.getAttribute("data-test") ?? "").replace(/\d+/g, "#");
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  });

const headingsOf = (page: Page) =>
  page.evaluate(() => ({
    h1: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim()).slice(0, 3),
    h2: [...document.querySelectorAll("h2")].map((h) => h.textContent?.trim()).slice(0, 4),
  }));

await strategyFreshContextGoto();
await strategyPersistentProfileGoto();
await strategyClientSideNavigation();
