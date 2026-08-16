/**
 * Combined HTML report from the last API (JUnit) and E2E (Playwright JSON) runs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync, execSync } from "node:child_process";
import { resolve } from "node:path";

interface Row {
  suite: "API" | "E2E";
  name: string;
  file: string;
  status: "pass" | "fail" | "skip" | "known-fail";
  durationMs: number;
  detail: string;
}

const REPORT_DIR = "reports";
const API_JUNIT = `${REPORT_DIR}/api.junit.xml`;
const E2E_JSON = `${REPORT_DIR}/e2e.json`;
const OUT = `${REPORT_DIR}/index.html`;

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function parseApiJunit(xml: string): Row[] {
  const rows: Row[] = [];
  const cases = xml.matchAll(
    /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>|<testcase\b([^>]*)\/>/g,
  );

  for (const match of cases) {
    const attrs = match[1] ?? match[3] ?? "";
    const body = match[2] ?? "";
    const name = decodeXml(/name="([^"]*)"/.exec(attrs)?.[1] ?? "unnamed");
    const file = decodeXml(/file="([^"]*)"/.exec(attrs)?.[1] ?? /classname="([^"]*)"/.exec(attrs)?.[1] ?? "tests/api");
    const time = Number(/time="([^"]*)"/.exec(attrs)?.[1] ?? 0);

    let status: Row["status"] = "pass";
    let detail = "";
    if (/<skipped\b/.test(body)) {
      status = "skip";
      detail = decodeXml(/<skipped[^>]*message="([^"]*)"/.exec(body)?.[1] ?? "skipped");
    } else if (/<failure\b/.test(body) || /<error\b/.test(body)) {
      status = "fail";
      detail = decodeXml(
        /<(?:failure|error)[^>]*message="([^"]*)"/.exec(body)?.[1] ?? "failed",
      );
    }

    rows.push({
      suite: "API",
      name,
      file: file.replaceAll("\\", "/"),
      status,
      durationMs: Math.round(time * 1000),
      detail,
    });
  }

  return rows;
}

interface PlaywrightJSON {
  suites?: PlaywrightSuite[];
}

interface PlaywrightSuite {
  title?: string;
  file?: string;
  suites?: PlaywrightSuite[];
  specs?: Array<{
    title: string;
    file?: string;
    tests?: Array<{
      expectedStatus?: string;
      projectName?: string;
      results?: Array<{ status?: string; duration?: number; error?: { message?: string } }>;
    }>;
  }>;
}

function walkPlaywright(suite: PlaywrightSuite, rows: Row[]): void {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const last = test.results?.at(-1);
      const raw = last?.status ?? "skipped";
      const expected = test.expectedStatus ?? "passed";

      let status: Row["status"] = "pass";
      if (raw === "skipped") status = "skip";
      else if (raw === "passed") status = "pass";
      else if (expected === "failed" || expected === "timedOut") status = "known-fail";
      else status = "fail";

      const prefix = suite.title ? `${suite.title} > ` : "";
      rows.push({
        suite: "E2E",
        name: `${prefix}${spec.title}`,
        file: spec.file ?? suite.file ?? "tests/e2e",
        status,
        durationMs: last?.duration ?? 0,
        detail: stripAnsi(last?.error?.message?.split("\n")[0] ?? ""),
      });
    }
  }

  for (const child of suite.suites ?? []) walkPlaywright(child, rows);
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "").trim();
}

function parseE2eJson(raw: string): Row[] {
  const data = JSON.parse(raw) as PlaywrightJSON;
  const rows: Row[] = [];
  for (const suite of data.suites ?? []) walkPlaywright(suite, rows);
  return rows;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function render(rows: Row[]): string {
  const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const pass = rows.filter((row) => row.status === "pass").length;
  const fail = rows.filter((row) => row.status === "fail").length;
  const skip = rows.filter((row) => row.status === "skip").length;
  const known = rows.filter((row) => row.status === "known-fail").length;
  const api = rows.filter((row) => row.suite === "API").length;
  const e2e = rows.filter((row) => row.suite === "E2E").length;
  const duration = rows.reduce((sum, row) => sum + row.durationMs, 0);
  const overall = fail === 0 ? "passed" : "failed";

  const tableRows = rows
    .map((row) => {
      const label =
        row.status === "pass"
          ? "Pass"
          : row.status === "fail"
            ? "Fail"
            : row.status === "skip"
              ? "Skip"
              : "Known fail";
      return `<tr data-suite="${row.suite}" data-status="${row.status}">
  <td>${row.suite}</td>
  <td>${escapeHtml(row.name)}<div class="file">${escapeHtml(row.file)}</div></td>
  <td><span class="pill ${row.status}">${label}</span></td>
  <td class="num">${formatMs(row.durationMs)}</td>
  <td class="detail">${escapeHtml(row.detail)}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Product Hunt QA report</title>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #1a2129;
      --line: #2a3440;
      --text: #e7edf3;
      --muted: #8b9aab;
      --pass: #3dd68c;
      --fail: #f07178;
      --skip: #8b9aab;
      --known: #e6c07b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 14px/1.45 "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    header {
      padding: 28px 32px 16px;
      border-bottom: 1px solid var(--line);
    }
    header h1 { margin: 0 0 6px; font-size: 22px; font-weight: 600; }
    header p { margin: 0; color: var(--muted); }
    .overall {
      display: inline-block;
      margin-left: 10px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      vertical-align: middle;
    }
    .overall.passed { background: #143d2a; color: var(--pass); }
    .overall.failed { background: #4a1d22; color: var(--fail); }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      padding: 20px 32px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .card .label { color: var(--muted); font-size: 12px; }
    .card .value { font-size: 22px; font-weight: 600; margin-top: 4px; }
    .toolbar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 0 32px 16px;
    }
    button {
      background: var(--panel);
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 12px;
      cursor: pointer;
    }
    button.active { border-color: var(--pass); color: var(--pass); }
    table { width: calc(100% - 64px); margin: 0 32px 40px; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .file { color: var(--muted); font-size: 12px; margin-top: 2px; }
    .num { font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; }
    .detail { color: var(--muted); max-width: 420px; }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
    }
    .pill.pass { background: #143d2a; color: var(--pass); }
    .pill.fail { background: #4a1d22; color: var(--fail); }
    .pill.skip { background: #243040; color: var(--skip); }
    .pill.known-fail { background: #3d3420; color: var(--known); }
    footer { padding: 0 32px 32px; color: var(--muted); font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>Product Hunt QA report <span class="overall ${overall}">${overall}</span></h1>
    <p>API and E2E results from the last local run. Generated ${generatedAt}.</p>
  </header>
  <section class="cards">
    <div class="card"><div class="label">Tests</div><div class="value">${rows.length}</div></div>
    <div class="card"><div class="label">Passed</div><div class="value" style="color:var(--pass)">${pass}</div></div>
    <div class="card"><div class="label">Failed</div><div class="value" style="color:var(--fail)">${fail}</div></div>
    <div class="card"><div class="label">Known fails</div><div class="value" style="color:var(--known)">${known}</div></div>
    <div class="card"><div class="label">Skipped</div><div class="value">${skip}</div></div>
    <div class="card"><div class="label">API / E2E</div><div class="value">${api} / ${e2e}</div></div>
    <div class="card"><div class="label">Duration</div><div class="value">${formatMs(duration)}</div></div>
  </section>
  <div class="toolbar">
    <button class="active" data-filter="all">All</button>
    <button data-filter="API">API</button>
    <button data-filter="E2E">E2E</button>
    <button data-filter="fail">Failed</button>
    <button data-filter="known-fail">Known fails</button>
  </div>
  <table>
    <thead>
      <tr>
        <th>Suite</th>
        <th>Test</th>
        <th>Status</th>
        <th>Time</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
${tableRows || `<tr><td colspan="5">No results yet. Run <code>bun run all</code> first.</td></tr>`}
    </tbody>
  </table>
  <footer>
    Known fail = Playwright <code>test.fail</code> for a documented product bug. Those should stay red until the bug is fixed.
    Playwright traces and screenshots (on failure) are in <code>playwright-report/</code>.
  </footer>
  <script>
    const buttons = document.querySelectorAll("button[data-filter]");
    const rows = document.querySelectorAll("tbody tr");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((other) => other.classList.remove("active"));
        button.classList.add("active");
        const filter = button.dataset.filter;
        rows.forEach((row) => {
          const suite = row.dataset.suite;
          const status = row.dataset.status;
          const show =
            filter === "all" ||
            filter === suite ||
            filter === status;
          row.style.display = show ? "" : "none";
        });
      });
    });
  </script>
</body>
</html>
`;
}

mkdirSync(REPORT_DIR, { recursive: true });

const rows: Row[] = [];
if (existsSync(API_JUNIT)) rows.push(...parseApiJunit(readFileSync(API_JUNIT, "utf8")));
if (existsSync(E2E_JSON)) rows.push(...parseE2eJson(readFileSync(E2E_JSON, "utf8")));

writeFileSync(OUT, render(rows));
console.log(`Wrote ${OUT} (${rows.length} tests)`);

if (process.argv.includes("--open")) {
  openInBrowser(resolve(OUT));
}

function openInBrowser(file: string): void {
  try {
    if (process.platform === "win32") {
      const cmd = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";
      execFileSync(cmd, ["/c", "start", "", file], { windowsHide: true });
    } else if (process.platform === "darwin") {
      execFileSync("open", [file]);
    } else {
      execFileSync("xdg-open", [file]);
    }
    console.log(`Opened ${file}`);
  } catch {
    try {
      execSync(`Start-Process -FilePath "${file}"`, { shell: "powershell.exe" });
      console.log(`Opened ${file}`);
    } catch {
      console.log(`Could not open the browser automatically. Open this file: ${file}`);
    }
  }
}
