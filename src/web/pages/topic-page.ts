import { BasePage } from "./base-page";

export class TopicPage extends BasePage {
  async open(slug: string) {
    return this.visit(`/topics/${slug}`);
  }

  get heading() {
    return this.page.getByRole("heading", { level: 1 });
  }

  get productListItems() {
    return this.page.locator('main li:has(a[href^="/products/"])');
  }

  get resultSummary() {
    return this.page.getByText(/showing \d+-\d+ of [\d,]+ products/i);
  }

  // exact: true — product names like "Next.js" also contain "Next".
  get nextPageLink() {
    return this.page.getByRole("link", { name: "Next", exact: true });
  }

  get firstPageButton() {
    return this.page.getByRole("button", { name: "First" });
  }

  get previousPageButton() {
    return this.page.getByRole("button", { name: "Previous" });
  }
}
