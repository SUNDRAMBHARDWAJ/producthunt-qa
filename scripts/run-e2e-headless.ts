/**
 * Runs Playwright with PH_HEADLESS=true. Cloudflare usually blocks this;
 * bun run test:e2e (headed Chrome) is the run that works.
 */
import { spawnSync } from "node:child_process";

process.env.PH_HEADLESS = "true";

const extra = process.argv.slice(2);
const result = spawnSync(
  "node",
  ["node_modules/@playwright/test/cli.js", "test", ...extra],
  { stdio: "inherit", env: process.env, shell: true },
);

process.exit(result.status ?? 1);
