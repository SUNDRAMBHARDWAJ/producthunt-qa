import { BasePage } from "./base-page";

export type AuthProvider = "google" | "linkedin" | "github" | "twitter" | "facebook" | "apple";

export class LoginModal extends BasePage {
  get container() {
    return this.page.getByTestId("login-screen");
  }

  get closeButton() {
    return this.page.getByTestId("modal-close");
  }

  provider(name: AuthProvider) {
    return this.page.getByTestId(`login-with-${name}`);
  }
}
