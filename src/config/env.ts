import { existsSync, readFileSync } from "node:fs";

// Playwright runs under Node, which does not auto-load .env the way Bun does.
function loadEnvFile(path = ".env"): void {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

export const config = {
  apiUrl: process.env.PH_API_URL || "https://api.producthunt.com/v2/api/graphql",
  webUrl: process.env.PH_WEB_URL || "https://www.producthunt.com",
  apiToken: (process.env.PH_API_TOKEN || "").trim(),
  googleEmail: (process.env.PH_GOOGLE_EMAIL || "").trim(),
  googlePassword: (process.env.PH_GOOGLE_PASSWORD || "").trim(),
  requestTimeoutMs: Number(process.env.PH_REQUEST_TIMEOUT_MS || 15_000),
} as const;

export const hasApiToken = config.apiToken.length > 0;

export const hasGoogleLogin =
  config.googleEmail.length > 0 && config.googlePassword.length > 0;
