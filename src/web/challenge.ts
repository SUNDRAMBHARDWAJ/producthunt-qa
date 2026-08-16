import type { Page } from "@playwright/test";

const CHALLENGE_TITLE = "Just a moment";
const CHALLENGE_FRAME = 'iframe[src*="challenges.cloudflare.com"]';

async function waitCleared(page: Page, timeoutMs: number): Promise<boolean> {
  if (timeoutMs <= 0) return false;
  return page
    .waitForFunction(
      (title) =>
        !document.title.includes(title) &&
        document.querySelector('input[name="cf-turnstile-response"]') === null,
      CHALLENGE_TITLE,
      { timeout: timeoutMs },
    )
    .then(() => true)
    .catch(() => false);
}

async function clickChallengeCheckbox(page: Page): Promise<boolean> {
  const widget = page.locator(CHALLENGE_FRAME).first();
  const box = await widget.boundingBox({ timeout: 3_000 }).catch(() => null);
  if (box === null) return false;

  const x = box.x + 30;
  const y = box.y + box.height / 2;

  try {
    await page.mouse.move(x - 60, y + 20, { steps: 12 });
    await page.mouse.move(x, y, { steps: 8 });
    await page.mouse.click(x, y, { delay: 90 });
    return true;
  } catch {
    return false;
  }
}

export async function waitForAppShell(page: Page, timeoutMs = 60_000): Promise<void> {
  if (page.isClosed()) {
    throw new Error("The browser closed before the app loaded (often during Google sign-in).");
  }

  const deadline = Date.now() + timeoutMs;

  if (await waitCleared(page, Math.min(10_000, timeoutMs))) return;

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new Error("The browser closed while waiting for Cloudflare to clear.");
    }
    const clicked = await clickChallengeCheckbox(page);
    const remaining = deadline - Date.now();
    if (await waitCleared(page, Math.min(clicked ? 20_000 : 5_000, remaining))) return;
  }

  const title = page.isClosed() ? "(closed)" : await page.title().catch(() => "(unknown)");
  throw new Error(
    `Bot-protection challenge did not clear within ${timeoutMs}ms (title: "${title}"). ` +
      "See docs/findings.md. This reports an unavailable environment, not a product regression.",
  );
}

export async function isChallengePage(page: Page): Promise<boolean> {
  return (await page.title()).includes(CHALLENGE_TITLE);
}

export async function dismissCookieBanner(page: Page): Promise<void> {
  const dismiss = page.getByTestId("dismiss-CookiePopup");
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click({ timeout: 5_000 }).catch(() => {});
  }
}

// Close is also a Product Hunt product — only click modal-close, not a page-wide "Close".
export async function dismissOverlays(
  page: Page,
  options: { keepLoginModal?: boolean } = {},
): Promise<void> {
  if (page.isClosed()) return;

  page.once("dialog", (dialog) => {
    void dialog.dismiss().catch(() => {});
  });

  await dismissCookieBanner(page);

  const loginOpen = await page
    .getByTestId("login-screen")
    .isVisible()
    .catch(() => false);
  if (options.keepLoginModal && loginOpen) return;

  const overlay = page.getByTestId("modal");
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!(await overlay.first().isVisible().catch(() => false))) break;

    const close = page.getByTestId("modal-close").or(page.getByLabel(/^close$/i));
    await close.first().click({ force: true, timeout: 3_000 }).catch(() => {});
  }
}
