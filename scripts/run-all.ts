/**
 * bun run all — typecheck, API, E2E, then the combined HTML report.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { hasApiToken } from "../src/config/env";

interface Phase {
  name: string;
  reason: string;
  command: string;
  args: string[];
}

const phases: Phase[] = [
  {
    name: "Typecheck",
    reason: "static errors are free to find and cost the most to find later",
    command: "node",
    args: ["node_modules/typescript/bin/tsc", "--noEmit"],
  },
  {
    name: "API tests",
    reason: "fast contract checks before spending time on a browser",
    command: "bun",
    args: ["test", "tests/api", "--reporter=junit", "--reporter-outfile=reports/api.junit.xml"],
  },
  {
    name: "E2E tests",
    reason: "headed Chrome against the live site (Cloudflare blocks headless)",
    command: "node",
    args: ["node_modules/@playwright/test/cli.js", "test"],
  },
];

function heading(text: string): void {
  console.log(`\n${"=".repeat(72)}\n${text}\n${"=".repeat(72)}`);
}

function preflight(): void {
  heading("Preflight");

  if (!existsSync("node_modules")) {
    console.error("Dependencies are missing. Run: bun install");
    process.exit(1);
  }

  for (const tool of ["node", "bun"] as const) {
    const probe = spawnSync(tool, ["--version"], { encoding: "utf8", shell: true });
    if (probe.status !== 0) {
      console.error(`${tool} was not found on PATH. Both Node and Bun are required (see README).`);
      process.exit(1);
    }
    console.log(`  ${tool} ${probe.stdout.trim()}`);
  }

  if (!existsSync("node_modules/@playwright/test")) {
    console.error("Playwright is not installed. Run: bun install && bun run browsers");
    process.exit(1);
  }

  mkdirSync("reports", { recursive: true });

  console.log(
    hasApiToken
      ? "  PH_API_TOKEN found. Full API suite will run."
      : "  PH_API_TOKEN missing. Data-dependent API tests will skip.",
  );
}

interface Result {
  name: string;
  passed: boolean;
  seconds: string;
}

function run(): number {
  preflight();

  const results: Result[] = [];

  for (const [index, phase] of phases.entries()) {
    heading(`[${index + 1}/${phases.length}] ${phase.name}\n${phase.reason}`);

    const startedAt = Date.now();
    const outcome = spawnSync(phase.command, phase.args, { stdio: "inherit", shell: true });
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    const passed = outcome.status === 0;

    results.push({ name: phase.name, passed, seconds });

    if (!passed) {
      summarise(results);
      writeCombinedReport();
      console.log(`\nStopped at "${phase.name}".`);
      return outcome.status ?? 1;
    }
  }

  summarise(results);
  writeCombinedReport();
  console.log("\nAll phases passed.");
  return 0;
}

function writeCombinedReport(): void {
  const report = spawnSync("bun", ["run", "scripts/build-report.ts", "--", "--open"], {
    stdio: "inherit",
    shell: true,
  });
  if (report.status === 0) {
    console.log("Opened reports/index.html");
  }
}

function summarise(results: Result[]): void {
  heading("Summary");
  for (const result of results) {
    console.log(`  ${result.passed ? "PASS" : "FAIL"}  ${result.name.padEnd(12)} ${result.seconds}s`);
  }

  const skipped = phases.length - results.length;
  if (skipped > 0) console.log(`  ----  ${skipped} phase(s) not run`);

  const total = results.reduce((sum, result) => sum + Number(result.seconds), 0);
  console.log(`\n  total ${total.toFixed(1)}s`);
}

process.exit(run());
