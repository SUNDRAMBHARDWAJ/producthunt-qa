import { expect, test } from "../../src/web/fixtures";

test.describe("Topic browsing", () => {
  test("topic page lists products and starts on a correctly bounded first page", async ({ topicPage, page }) => {
    await topicPage.open("artificial-intelligence");

    await expect(page).toHaveTitle(/artificial intelligence \| product hunt/i);
    await expect(topicPage.heading).toHaveText(/artificial intelligence/i);

    await expect(topicPage.productListItems.first()).toBeVisible();
    expect(await topicPage.productListItems.count()).toBeGreaterThan(9);

    await expect(topicPage.resultSummary).toBeVisible();
    await expect(topicPage.firstPageButton).toBeDisabled();
    await expect(topicPage.previousPageButton).toBeDisabled();
    await expect(topicPage.nextPageLink).toHaveAttribute("href", /page=2/);
  });
});
