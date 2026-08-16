import { BasePage } from "./base-page";

export class HomePage extends BasePage {
  async open() {
    return this.visit("/");
  }

  get heading() {
    return this.page.getByRole("heading", { level: 1 });
  }

  get todaySection() {
    return this.page.getByTestId("homepage-section-today");
  }

  get yesterdaySection() {
    return this.page.getByTestId("homepage-section-yesterday");
  }

  get lastWeekSection() {
    return this.page.getByTestId("homepage-section-last-week");
  }

  get lastMonthSection() {
    return this.page.getByTestId("homepage-section-last-month");
  }

  get productLinks() {
    return this.page.locator('a[href^="/products/"]');
  }

  get voteButtons() {
    return this.page.getByTestId("vote-button");
  }
}
