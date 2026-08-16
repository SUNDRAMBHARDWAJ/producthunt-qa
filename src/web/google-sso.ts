import type { Page } from "@playwright/test";

export async function completeGoogleSignIn(
  googlePage: Page,
  email: string,
  password: string,
): Promise<void> {
  const emailBox = googlePage.locator('input[type="email"], #identifierId').first();
  await emailBox.waitFor({ state: "visible", timeout: 30_000 });
  await emailBox.click();
  await emailBox.fill(email);
  await googlePage.getByRole("button", { name: /^next$/i }).first().click();

  const passwordBox = googlePage.locator('input[type="password"], input[name="Passwd"]').first();
  await passwordBox.waitFor({ state: "visible", timeout: 30_000 });
  await passwordBox.click();
  await passwordBox.fill(password);

  const submit = googlePage
    .locator("#passwordNext")
    .or(googlePage.getByRole("button", { name: /^(next|continue)$/i }))
    .first();
  await submit.click();

  for (let attempt = 0; attempt < 6; attempt++) {
    const extra = googlePage.getByRole("button", {
      name: /^(continue|next|i agree|allow|skip)$/i,
    });
    if (await extra.first().isVisible().catch(() => false)) {
      await extra.first().click({ timeout: 3_000 }).catch(() => {});
    }

    const blocked = await googlePage.getByText(/couldn.?t sign you in|browser or app may not be secure/i).first().isVisible().catch(() => false);
    if (blocked) {
      throw new Error(
        "Google blocked the automated sign-in. Headed Chrome sometimes still works if you complete the prompt once by hand; then re-run.",
      );
    }

    if (googlePage.isClosed()) return;
    if (!googlePage.url().includes("accounts.google.com")) return;

    await googlePage
      .waitForURL((url) => !url.href.includes("accounts.google.com"), { timeout: 2_500 })
      .catch(() => {});
  }
}
