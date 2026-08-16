import type { Page, Response } from "@playwright/test";
import { dismissOverlays, waitForAppShell } from "../challenge";

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  protected async visit(path: string): Promise<Response | null> {
    const response = await this.page.goto(path, { waitUntil: "domcontentloaded" });
    await waitForAppShell(this.page);
    await dismissOverlays(this.page);
    return response;
  }

  async openPath(path: string): Promise<Response | null> {
    return this.visit(path);
  }

  get signInLink() {
    return this.page.getByTestId("header-nav-link-sign-in");
  }

  get searchTrigger() {
    return this.page.getByTestId("header-search-input");
  }
}
