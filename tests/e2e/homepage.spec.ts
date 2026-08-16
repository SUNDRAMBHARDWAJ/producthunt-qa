import { expect, test } from "../../src/web/fixtures";
import { finalDocumentStatus, trackDocumentStatuses } from "../../src/web/navigation";

test.describe("Homepage launch board", () => {
  test("lists today's launches with vote counts and the dated leaderboards", async ({ homePage, page }) => {
    const statuses = trackDocumentStatuses(page);

    await homePage.open();

    expect(finalDocumentStatus(statuses)).toBe(200);
    await expect(homePage.heading).toContainText(/top products launching today/i);

    await expect(homePage.todaySection).toBeVisible();
    await expect(homePage.yesterdaySection).toBeVisible();
    await expect(homePage.lastWeekSection).toBeVisible();
    await expect(homePage.lastMonthSection).toBeVisible();

    expect(await homePage.productLinks.count()).toBeGreaterThan(5);

    const firstVote = homePage.voteButtons.first();
    await expect(firstVote).toBeVisible();
    expect((await firstVote.innerText()).trim()).toMatch(/^\d[\d,]*$/);
  });
});
