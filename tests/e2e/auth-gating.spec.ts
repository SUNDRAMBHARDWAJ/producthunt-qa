import { expect, test } from "../../src/web/fixtures";

// Anonymous path only. Production is the only env, so we do not cast a real vote.

test.describe("Anonymous access control", () => {
  test("prompts sign-in and never persists an anonymous vote", async ({ productPage, loginModal, page }) => {
    await productPage.open("notion");

    await expect(productPage.voteButton).toBeVisible();
    const countBefore = await productPage.voteCount();

    // BUG-3: vote button is clickable before its handler is attached.
    await expect(async () => {
      await productPage.voteButton.click();
      await expect(loginModal.container).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    await expect(loginModal.provider("google")).toBeVisible();
    await expect(loginModal.provider("github")).toBeVisible();

    await productPage.open("notion");
    expect(await productPage.voteCount()).toBe(countBefore);
    await expect(productPage.signInLink).toBeVisible();
  });

  // BUG-2: count increments on screen before login. test.fail until the product is fixed.
  test.fail("does not optimistically increment the count for an anonymous visitor", async ({
    productPage,
    loginModal,
  }) => {
    await productPage.open("notion");
    const countBefore = await productPage.voteCount();

    await expect(async () => {
      await productPage.voteButton.click();
      await expect(loginModal.container).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    expect(await productPage.voteCount()).toBe(countBefore);
  });
});
