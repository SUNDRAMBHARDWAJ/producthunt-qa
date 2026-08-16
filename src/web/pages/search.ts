import { expect } from "@playwright/test";
import { dismissOverlays, waitForAppShell } from "../challenge";
import { BasePage } from "./base-page";

// Header search is readonly — the real input lives in the spotlight overlay.
export class SearchOverlay extends BasePage {
  get modal() {
    return this.page.getByTestId("spotlight-search");
  }

  get input() {
    return this.page.getByTestId("spotlight-search-input");
  }

  get closeButton() {
    return this.page.getByTestId("modal-close");
  }

  get productSuggestions() {
    return this.page.getByTestId(/^spotlight-result-product-/);
  }

  async open() {
    await dismissOverlays(this.page);
    await this.searchTrigger.click({ timeout: 10_000 });
    await expect(this.modal).toBeVisible({ timeout: 10_000 });
  }

  async type(term: string) {
    await this.input.fill(term);
  }

  async submit() {
    await Promise.all([this.page.waitForURL(/\/search\?q=/, { timeout: 60_000 }), this.input.press("Enter")]);
    await waitForAppShell(this.page);
  }
}

export class SearchResultsPage extends BasePage {
  async open(term: string) {
    return this.visit(`/search?q=${encodeURIComponent(term)}`);
  }

  get results() {
    return this.page.getByTestId(/^spotlight-result-product-/);
  }

  get resultLinks() {
    return this.page.locator('a[href^="/products/"]');
  }
}
