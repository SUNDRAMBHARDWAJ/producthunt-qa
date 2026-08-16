import { expect, test } from "../../src/web/fixtures";
import { finalDocumentStatus, trackDocumentStatuses } from "../../src/web/navigation";

test.describe("Error handling", () => {
  test("unknown URL returns a real 404 rather than a soft 200", async ({ homePage, page }) => {
    const statuses = trackDocumentStatuses(page);

    await homePage.openPath("/qa-nonexistent-page-check-12345");

    expect(finalDocumentStatus(statuses)).toBe(404);
    await expect(page.getByText(/we seem to have lost this page/i)).toBeVisible();
    await expect(homePage.searchTrigger).toBeVisible();
  });
});
