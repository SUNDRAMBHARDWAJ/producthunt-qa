import { expect, test } from "../../src/web/fixtures";

test.describe("Search", () => {
  test("spotlight suggests matching products and opens the results page", async ({
    homePage,
    searchOverlay,
    searchResultsPage,
    page,
  }) => {
    await homePage.open();

    await searchOverlay.open();
    await searchOverlay.type("notion");

    const suggestions = searchOverlay.productSuggestions;
    await expect(suggestions.first()).toBeVisible();
    await expect(suggestions.first()).toContainText(/notion/i);

    await searchOverlay.submit();

    await expect(page).toHaveURL(/\/search\?q=notion/);
    await expect(searchResultsPage.results.first()).toBeVisible();
    expect(await searchResultsPage.results.count()).toBeGreaterThan(1);

    await expect(searchResultsPage.results.filter({ hasText: /notion/i }).first()).toBeVisible();
  });

  // BUG-1: results page keeps the homepage title and has no h1.
  test.fail("results page has a descriptive title and a top-level heading", async ({ searchResultsPage, page }) => {
    await searchResultsPage.open("notion");

    await expect(page).toHaveTitle(/notion/i);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
