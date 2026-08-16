# Product Hunt QA

Take-home: treat Product Hunt as a product my team just shipped and own quality for it.

- [docs/test-strategy.md](docs/test-strategy.md) — what I would test first, and why
- [docs/findings.md](docs/findings.md) — bugs and security notes from exploration
- `tests/e2e` — 8 Playwright scenarios
- `tests/api` — 11 Bun tests (auth, posts, transport, limits, headers/CORS)
- `scripts/` — probes used during exploration, plus the full-suite runner

## Setup

```bash
bun install
bun run browsers
cp .env.example .env   # add PH_API_TOKEN, and Google email/password for the E2E login step
```

Bun installs packages and runs the API tests. Playwright's runner needs Node (on Windows, Bun cannot launch the browser), so E2E scripts call Playwright through Node. You need both: Node 20+ and Bun 1.2+.

**API token.** Create an app at [producthunt.com/v2/oauth/applications](https://www.producthunt.com/v2/oauth/applications) and put the developer token in `.env` as `PH_API_TOKEN`. Without a token, the data-dependent API tests skip instead of failing.

**Google login (E2E, optional).** Copy `.env.example` to `.env` and fill `PH_GOOGLE_EMAIL` / `PH_GOOGLE_PASSWORD` if you want the `login` project to sign in with Google. If those values are missing, or Google sign-in fails, that one test is marked **failed** in the report and every other E2E test still runs logged out. Cookie and leftover dialogs are dismissed as they appear. Anonymous vote tests always run logged out.

## How to run

```bash
bun run all              # typecheck, API, E2E, then opens reports/index.html
bun run report           # combined HTML report (API + E2E) in the browser

bun run test:api         # API only
bun run test:e2e         # E2E, headed Chrome (this is the run that actually works)
bun run test:e2e:headless
bun run test:e2e:ui
bun run report:e2e       # Playwright's own report (traces / screenshots)
bun run typecheck
```

`bun run all` is the one I use. Typecheck first, then API, then E2E. It stops on the first failure. When it finishes, the combined report opens in your browser automatically (`reports/index.html`).

### Headless vs headed

The brief asks for headless E2E. Against Product Hunt that does not work: Cloudflare returns `Just a moment...` and never hands over. I measured this in `scripts/probe-bot-protection.ts`.

| How you run it | What happens |
| --- | --- |
| `bun run test:e2e` (headed Chrome) | Works locally |
| `bun run test:e2e:headless` | Hits Cloudflare and times out |
| CI (`xvfb-run`) | No visible window, but still a headed browser. GitHub IPs get challenged anyway |

CI uses `xvfb` so there is no desktop, which is the usual way to keep Playwright CI-ready when the site blocks true headless. The E2E job is `continue-on-error` because a failure there means Cloudflare blocked the runner, not that the product broke.

Chrome vs Chromium: the assignment only requires Playwright. It does not name a browser. The suite uses installed Chrome (`channel: "chrome"`) because bundled Chromium is challenged harder. `PH_BROWSER_CHANNEL=chromium` falls back if Chrome is missing.

## Findings (short)

Full write-up: [docs/findings.md](docs/findings.md).

| ID | Severity | Issue |
| --- | --- | --- |
| BUG-1 | Medium | Search results keep the homepage title and have no heading |
| BUG-2 | Medium–High | Anonymous upvote bumps the count on screen, then asks you to log in |
| BUG-3 | Medium | Clicking upvote too early after load does nothing (hydration) |
| BUG-4 | Medium | Search and login overlays have no `role="dialog"` |
| BUG-5 | Low | Some homepage images have no `alt` |
| BUG-6 | Low | CORS lists GET, but GET on the GraphQL URL returns HTML 404 |
| BUG-7 | Medium | Auth errors use `error` / `error_description` instead of GraphQL `message` |
| BUG-8 | Low | 404 pages keep the homepage title |

Things the API does well: auth before parse (anonymous callers cannot probe the schema), JSON-only bodies, query cost cap (64.9M vs 500K), HSTS, outbound links with `rel="noreferrer noopener ugc"`.

Things I would raise: tracking cookies before consent, no CSP on app pages, `ACAO: *` plus `authorization` (safe only while credentials are not allowed), HSTS `preload` with a 30-day max-age.

BUG-1 and BUG-2 are encoded as `test.fail` so the suite flips when they are fixed.

## Architecture

- API tests are `*.test.ts` under `bun test`. E2E tests are `*.spec.ts` under Playwright. Different file names so the runners do not pick up each other's files.
- The GraphQL client returns `{ status, headers, body }` and does not throw on 401s. Several tests are about those errors. Happy-path tests use `expectData()`.
- Types for the fields we query are written by hand in `src/api/types.ts`. Queries live in `src/api/queries.ts`.
- Page objects hold locators. Specs hold assertions. `BasePage.visit()` waits out Cloudflare and dismisses the cookie banner.
- Locators use Product Hunt's `data-test` attributes (`testIdAttribute: "data-test"`).
- No `waitForTimeout`. Waits are conditions. The upvote retry uses `toPass()` because of BUG-3.
- HTTP status is taken from the last document response, because the Cloudflare page answers the same URL with 403 first.
- Test data is read-only (`notion`, `artificial-intelligence`). Nothing writes to production.

## Trade-offs

- **Headless E2E does not work here.** Cloudflare never hands over to a headless browser; headed Chrome does. `bun run test:e2e:headless` is the blocked mode; `bun run test:e2e` is the run that works. See `playwright.config.ts`.
- **GitHub Actions E2E is informational.** The job is `continue-on-error` because GitHub IPs get challenged and never clear. A red E2E job in CI means the runner could not reach the site, not that the product broke. Local headed Chrome is the real gate. See `.github/workflows/ci.yml`.
- **No signed-in vote test.** Production is the only environment. Casting a real vote would write to a live product, so coverage stops at the anonymous gate (`tests/e2e/auth-gating.spec.ts`).
- Two E2E specs share the Notion product page so they do not depend on today's launches.

## If I had more time

1. Staging / WAF bypass so E2E can run headless in CI for real.
2. A test account: vote, un-vote, double submit, API vs UI count.
3. Schema codegen and a contract snapshot in CI.
4. axe-core on the pages we already cover (BUG-4, BUG-5).
5. k6 on the posts query for a launch-morning spike.
6. Visual checks on launch cards.
7. Synthetics from two regions, not only the daily GitHub cron.

## Layout

```
src/api        GraphQL client, queries, types
src/config     .env loading (Bun and Node)
src/web        page objects, fixtures, Cloudflare wait
tests/api      bun:test
tests/e2e      Playwright
tests/setup    one Cloudflare clearance per run
scripts/       probes, bun run all, report builder
docs/          strategy and findings
reports/       combined HTML report (generated, not committed)
.github/       API + security + E2E jobs
```

## CI

Three jobs on PR, push to main, and daily at 06:00 UTC:

1. API tests (typecheck + Bun). Token from `secrets.PH_API_TOKEN`.
2. Security: `bun audit` and a verified-only secret scan over full git history.
3. E2E under `xvfb-run`. Report uploaded as an artifact. `continue-on-error` because GitHub IPs do not get past Cloudflare.

The daily schedule is cheap production monitoring.
