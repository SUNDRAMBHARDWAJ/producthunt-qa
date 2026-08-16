import type { Page } from "@playwright/test";

// Cloudflare answers the same URL with 403 first; assert on the last document response.
export function trackDocumentStatuses(page: Page): number[] {
  const statuses: number[] = [];

  page.on("response", (response) => {
    const request = response.request();
    if (request.resourceType() === "document" && request.isNavigationRequest()) {
      statuses.push(response.status());
    }
  });

  return statuses;
}

export function finalDocumentStatus(statuses: number[]): number | undefined {
  return statuses.at(-1);
}
