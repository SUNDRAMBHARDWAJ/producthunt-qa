/** Maps search overlay, product page, 404, and anonymous vote. */
import { chromium, type Page } from "@playwright/test";

const WEB_URL = process.env.PH_WEB_URL || "https://www.producthunt.com";

async function settle(page: Page, timeout = 45_000) {
  await page
    .waitForFunction(() => !document.title.includes("Just a moment") && !!document.querySelector("main"), null, { timeout })
    .catch(() => console.log("    (interstitial did not clear)"));
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

const browser = await chromium.launch({ headless: false, args: ["--disable-blink-features=AutomationControlled"] });
const context = await browser.newContext({ locale: "en-US" });
const page = await context.newPage();

await page.goto(WEB_URL, { waitUntil: "domcontentloaded" });
await settle(page);
await page.locator('[data-test="dismiss-CookiePopup"]').click({ timeout: 8000 }).catch(() => console.log("no cookie popup"));

console.log("=== search overlay ===");
await page.locator('[data-test="header-search-input"]').click();
await page.waitForTimeout(2500);
console.log(`hooks after click: ${JSON.stringify(await hooksOf(page)).slice(0, 900)}`);
console.log(
  `editable inputs: ${JSON.stringify(
    await page.evaluate(() =>
      [...document.querySelectorAll("input")]
        .filter((i) => !i.readOnly && i.type !== "hidden")
        .map((i) => ({ name: i.name, placeholder: i.placeholder, test: i.getAttribute("data-test"), role: i.getAttribute("role") })),
    ),
  )}`,
);
console.log(`dialogs: ${await page.locator('[role="dialog"]').count()}`);

const searchBox = page.locator('input:not([readonly]):visible').first();
await searchBox.fill("notion").catch((e) => console.log(`fill failed: ${e.message.split("\n")[0]}`));
await page.waitForTimeout(3500);
console.log(`suggestion hooks: ${JSON.stringify(await hooksOf(page)).slice(0, 900)}`);
console.log(
  `suggestion text: ${(await page.evaluate(() => document.body.innerText.match(/notion[\s\S]{0,300}/i)?.[0] ?? "none")).slice(0, 300)}`,
);
await searchBox.press("Enter");
await page.waitForTimeout(6000);
await settle(page);
console.log(`search url: ${page.url()}`);
console.log(`search title: ${await page.title()}`);
console.log(`search hooks: ${JSON.stringify(await hooksOf(page)).slice(0, 1200)}`);
console.log(
  `search h1/h2/tabs: ${JSON.stringify(
    await page.evaluate(() => ({
      h1: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim()).slice(0, 3),
      h2: [...document.querySelectorAll("h2")].map((h) => h.textContent?.trim()).slice(0, 5),
      tabs: [...document.querySelectorAll('[role="tab"], nav a')].map((t) => t.textContent?.trim()).slice(0, 12),
      productLinks: [...new Set([...document.querySelectorAll('a[href^="/products/"]')].map((a) => a.getAttribute("href")))].slice(0, 6),
    })),
  ).slice(0, 1200)}`,
);

await page.waitForTimeout(3000);

console.log("\n=== product page ===");
await page.goto(`${WEB_URL}/products/notion`, { waitUntil: "domcontentloaded" });
await settle(page);
console.log(`url: ${page.url()}  title: ${await page.title()}`);
console.log(`hooks: ${JSON.stringify(await hooksOf(page)).slice(0, 1200)}`);
console.log(
  `content: ${JSON.stringify(
    await page.evaluate(() => ({
      h1: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim()).slice(0, 3),
      h2: [...document.querySelectorAll("h2")].map((h) => h.textContent?.trim()).slice(0, 6),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute("content")?.slice(0, 100),
      externalLinks: [...document.querySelectorAll('a[target="_blank"]')]
        .slice(0, 6)
        .map((a) => ({ href: (a.getAttribute("href") ?? "").slice(0, 60), rel: a.getAttribute("rel") })),
    })),
  ).slice(0, 1400)}`,
);

await page.waitForTimeout(3000);

console.log("\n=== anonymous vote attempt ===");
const vote = page.locator('[data-test="vote-button"]').first();
console.log(`vote buttons on product page: ${await page.locator('[data-test="vote-button"]').count()}`);
if ((await vote.count()) > 0) {
  await vote.click({ timeout: 10_000 }).catch((e) => console.log(`click failed: ${e.message.split("\n")[0]}`));
  await page.waitForTimeout(5000);
  console.log(`url after vote: ${page.url()}`);
  console.log(`dialogs: ${await page.locator('[role="dialog"]').count()}`);
  console.log(
    `signin markers: ${JSON.stringify(
      await page.evaluate(() => ({
        mentionsSignIn: /sign in|log in|continue with|sign up/i.test(document.body.innerText.slice(0, 6000)),
        dialogText: document.querySelector('[role="dialog"]')?.textContent?.trim().slice(0, 200),
        oauthButtons: [...document.querySelectorAll("button, a")]
          .map((b) => b.textContent?.trim() ?? "")
          .filter((t) => /google|twitter|linkedin|facebook|email/i.test(t))
          .slice(0, 8),
      })),
    )}`,
  );
}

await page.waitForTimeout(3000);

console.log("\n=== 404 handling ===");
const notFound = await page.goto(`${WEB_URL}/qa-nonexistent-page-check-12345`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
console.log(`status: ${notFound?.status()}  title: ${await page.title()}`);
console.log(
  `body snippet: ${(await page.evaluate(() => document.body.innerText.slice(0, 200))).replace(/\s+/g, " ")}`,
);

await browser.close();
