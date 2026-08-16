import { expect, test } from "../../src/web/fixtures";

const PRODUCT_SLUG = "notion";

test.describe("Product page", () => {
  test("shows product identity, section tabs, ratings and a safe outbound link", async ({ productPage, page }) => {
    await productPage.open(PRODUCT_SLUG);
    await expect(page).toHaveURL(/\/products\/notion/i);

    await expect(productPage.name).toHaveText(/notion/i);
    await expect(page).toHaveTitle(/notion/i);
    await expect(productPage.tagline).toBeVisible();

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://www.producthunt.com/products/${PRODUCT_SLUG}`,
    );

    for (const tab of ["overview", "launches", "reviews", "alternatives"] as const) {
      await expect(productPage.tab(tab)).toBeVisible();
    }

    await expect(productPage.visitWebsiteButton).toBeVisible();
    expect(await productPage.ratingStars.count()).toBeGreaterThan(0);

    const outbound = page.locator('a[target="_blank"][href*="notion.so"]').first();
    await expect(outbound).toHaveAttribute("rel", /noopener/);
    await expect(outbound).toHaveAttribute("rel", /noreferrer/);
  });
});
