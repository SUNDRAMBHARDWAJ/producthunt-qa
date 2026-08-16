import { test as base } from "@playwright/test";
import { HomePage } from "./pages/home-page";
import { LoginModal } from "./pages/login-modal";
import { ProductPage } from "./pages/product-page";
import { SearchOverlay, SearchResultsPage } from "./pages/search";
import { TopicPage } from "./pages/topic-page";

interface Pages {
  homePage: HomePage;
  loginModal: LoginModal;
  productPage: ProductPage;
  searchOverlay: SearchOverlay;
  searchResultsPage: SearchResultsPage;
  topicPage: TopicPage;
}

export const test = base.extend<Pages>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  loginModal: async ({ page }, use) => {
    await use(new LoginModal(page));
  },
  productPage: async ({ page }, use) => {
    await use(new ProductPage(page));
  },
  searchOverlay: async ({ page }, use) => {
    await use(new SearchOverlay(page));
  },
  searchResultsPage: async ({ page }, use) => {
    await use(new SearchResultsPage(page));
  },
  topicPage: async ({ page }, use) => {
    await use(new TopicPage(page));
  },
});

export { expect } from "@playwright/test";
