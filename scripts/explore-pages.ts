/** Page inspection after waiting out Cloudflare. */
import { chromium, type Page } from "@playwright/test";

const WEB_URL = process.env.PH_WEB_URL || "https://www.producthunt.com";

async function settle(page: Page) {
  await page
    .waitForFunction(() => !document.title.includes("Just a moment") && document.querySelector("main") !== null, null, {
      timeout: 60_000,
    })
    .catch(() => console.log("  (interstitial did not clear in 60s)"));
}

async function inspect(page: Page, path: string) {
  console.log(`\n=== ${path} ===`);
  const response = await page.goto(`${WEB_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await settle(page);

  console.log(`initial status: ${response?.status()}  title now: ${await page.title()}`);

  const details = await page.evaluate(() => {
    const hooks: Record<string, number> = {};
    for (const element of document.querySelectorAll("[data-test]")) {
      const key = (element.getAttribute("data-test") ?? "").replace(/\d+/g, "#");
      hooks[key] = (hooks[key] ?? 0) + 1;
    }
    return {
      hooks,
      h1: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim()).slice(0, 3),
      h2: [...document.querySelectorAll("h2")].map((h) => h.textContent?.trim()).slice(0, 6),
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute("content")?.slice(0, 120),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.slice(0, 80),
      productLinks: [...new Set([...document.querySelectorAll('a[href^="/products/"]')].map((a) => a.getAttribute("href")))].slice(0, 5),
    };
  });
  console.log(JSON.stringify(details, null, 1).slice(0, 2000));
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ locale: "en-US" });
const page = await context.newPage();

await inspect(page, "/");
await inspect(page, "/search?q=notion");
await inspect(page, "/topics/artificial-intelligence");
await inspect(page, "/leaderboard/daily/2026/8/14");
await inspect(page, "/products/notion");
await inspect(page, "/this-page-should-not-exist-qa-check");

// What does an anonymous vote attempt do?
console.log("\n=== anonymous vote attempt on homepage ===");
await page.goto(WEB_URL, { waitUntil: "domcontentloaded" });
await settle(page);
await page.locator('[data-test="dismiss-CookiePopup"]').click().catch(() => {});
const voteButton = page.locator('[data-test="vote-button"]').first();
console.log(`vote buttons: ${await page.locator('[data-test="vote-button"]').count()}`);
await voteButton.click().catch((error) => console.log(`click failed: ${error.message.split("\n")[0]}`));
await page.waitForTimeout(4000);
console.log(`url after vote click: ${page.url()}`);
console.log(`title after vote click: ${await page.title()}`);
const modal = await page.evaluate(() => ({
  dialogs: document.querySelectorAll('[role="dialog"]').length,
  bodyMentionsSignIn: /sign in|log in|continue with/i.test(document.body.innerText.slice(0, 4000)),
  visibleHeadings: [...document.querySelectorAll('[role="dialog"] h1, [role="dialog"] h2, [role="dialog"] h3')].map((h) => h.textContent?.trim()),
}));
console.log(JSON.stringify(modal));

await browser.close();
