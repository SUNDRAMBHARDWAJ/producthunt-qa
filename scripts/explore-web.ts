/** Selector / page exploration. Headed because Cloudflare rejects headless. */
import { chromium } from "@playwright/test";

// Deliberately no imports from src/ so this can run under either runtime.
const WEB_URL = process.env.PH_WEB_URL || "https://www.producthunt.com";

const PATHS = ["/", "/search?q=notion", "/topics/artificial-intelligence", "/leaderboard/daily"];

const SECURITY_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ locale: "en-US" });
const page = await context.newPage();

async function describe(url: string, dumpHeaders = false) {
  console.log(`\n=== ${url} ===`);
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

  console.log(`status: ${response?.status()}`);
  console.log(`title: ${await page.title()}`);
  console.log(`final url: ${page.url()}`);

  if (dumpHeaders) {
    const headers = response?.headers() ?? {};
    for (const name of SECURITY_HEADERS) {
      console.log(`  ${name}: ${headers[name] ? headers[name].slice(0, 200) : "(absent)"}`);
    }
    console.log(`  cookies: ${(await context.cookies()).map((c) => `${c.name}(secure=${c.secure},httpOnly=${c.httpOnly},sameSite=${c.sameSite})`).join(", ")}`);
  }

  const hooks = await page.evaluate(() => {
    const counts: Record<string, number> = {};
    for (const element of document.querySelectorAll("[data-test]")) {
      const key = (element.getAttribute("data-test") ?? "").replace(/\d+/g, "#");
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  });
  console.log(`data-test hooks: ${JSON.stringify(hooks).slice(0, 1200)}`);

  const structure = await page.evaluate(() => ({
    h1: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim()).slice(0, 3),
    h2: [...document.querySelectorAll("h2")].map((h) => h.textContent?.trim()).slice(0, 5),
    h3: [...document.querySelectorAll("h3")].map((h) => h.textContent?.trim()).slice(0, 5),
    mainCount: document.querySelectorAll("main").length,
    navCount: document.querySelectorAll("nav").length,
    inputs: [...document.querySelectorAll("input")].map((i) => ({
      type: i.type,
      name: i.name,
      placeholder: i.placeholder,
      ariaLabel: i.getAttribute("aria-label"),
    })),
    buttonLabels: [...document.querySelectorAll("button")]
      .map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 20),
    imageCount: document.querySelectorAll("img").length,
    imagesMissingAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
    linkSamples: [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? ""))]
      .filter((href) => href.startsWith("/"))
      .slice(0, 30),
  }));
  console.log(`structure: ${JSON.stringify(structure, null, 1).slice(0, 2500)}`);
}

for (const path of PATHS) {
  await describe(`${WEB_URL}${path}`, path === "/");
}

// Follow the first product link from the homepage to learn the detail page shape.
await page.goto(WEB_URL, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
const firstProductHref = await page
  .locator('a[href^="/products/"], a[href^="/posts/"]')
  .first()
  .getAttribute("href")
  .catch(() => null);
console.log(`\nfirst product href from homepage: ${firstProductHref}`);
if (firstProductHref) {
  await describe(`${WEB_URL}${firstProductHref}`);
}

await browser.close();
