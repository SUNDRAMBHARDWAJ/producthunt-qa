/** Measures which browser modes get past Cloudflare. */
import { chromium, type BrowserContextOptions, type LaunchOptions } from "@playwright/test";

const WEB_URL = process.env.PH_WEB_URL || "https://www.producthunt.com";

const CHALLENGE_MARKERS = ["Just a moment", "Attention Required", "Verifying you are human"];

const VARIANTS: Array<{ name: string; launch: LaunchOptions; context?: BrowserContextOptions }> = [
  { name: "headless shell (Playwright default)", launch: { headless: true } },
  { name: "headless chromium (new headless)", launch: { headless: true, channel: "chromium" } },
  {
    name: "headless chromium + AutomationControlled disabled",
    launch: {
      headless: true,
      channel: "chromium",
      args: ["--disable-blink-features=AutomationControlled"],
    },
  },
  { name: "headed chromium", launch: { headless: false } },
  {
    name: "headed chromium + AutomationControlled disabled",
    launch: { headless: false, args: ["--disable-blink-features=AutomationControlled"] },
  },
];

for (const variant of VARIANTS) {
  process.stdout.write(`\n=== ${variant.name} ===\n`);

  let browser;
  try {
    browser = await chromium.launch(variant.launch);
    const context = await browser.newContext({ locale: "en-US", ...variant.context });
    const page = await context.newPage();

    const response = await page.goto(WEB_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    let title = await page.title();
    let status = response?.status();

    // A real browser may clear the interstitial on its own; give it a chance.
    if (CHALLENGE_MARKERS.some((marker) => title.includes(marker))) {
      await page.waitForTimeout(12_000);
      title = await page.title();
    }

    const challenged = CHALLENGE_MARKERS.some((marker) => title.includes(marker));
    const postCount = await page.locator('a[href^="/posts/"]').count();

    console.log(`status: ${status}`);
    console.log(`title after settle: ${title}`);
    console.log(`challenge present: ${challenged}`);
    console.log(`post links found: ${postCount}`);
    console.log(`webdriver flag: ${await page.evaluate(() => navigator.webdriver)}`);
  } catch (error) {
    console.log(`failed: ${(error as Error).message.split("\n")[0]}`);
  } finally {
    await browser?.close();
  }
}
