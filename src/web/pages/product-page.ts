import { BasePage } from "./base-page";

export class ProductPage extends BasePage {
  async open(slug: string) {
    return this.visit(`/products/${slug}`);
  }

  get name() {
    return this.page.getByRole("heading", { level: 1 });
  }

  get tagline() {
    return this.page.getByRole("heading", { level: 2 }).first();
  }

  get visitWebsiteButton() {
    return this.page.getByTestId("visit-website-button");
  }

  // Scope next to "Visit website" so we do not pick a related-product vote further down.
  get voteButton() {
    return this.page
      .locator("div")
      .filter({ has: this.page.getByTestId("visit-website-button") })
      .getByTestId("vote-button")
      .first();
  }

  async voteCount(): Promise<number> {
    const label = await this.voteButton.innerText();
    const digits = label.match(/\d[\d,]*/)?.[0]?.replaceAll(",", "") ?? "";
    return Number(digits);
  }

  tab(name: "overview" | "launches" | "reviews" | "alternatives" | "customers" | "forum" | "team") {
    return this.page.getByTestId(`product-navigation-item-${name}`);
  }

  get ratingStars() {
    return this.page.getByTestId(/^star-\d+-(filled|not-filled)$/);
  }
}
