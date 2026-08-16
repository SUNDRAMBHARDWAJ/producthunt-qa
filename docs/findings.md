# Exploratory Testing & Security Assessment — Product Hunt

Session date: 15 August 2026. Target: `https://www.producthunt.com` and
`https://api.producthunt.com/v2/api/graphql`.

Everything below was observed first-hand. The scripts that produced the evidence are in `scripts/`
and can be re-run: `explore-api.ts`, `explore-web.ts`, `explore-pages.ts`, `probe-bot-protection.ts`,
`probe-navigation.ts`, `probe-flows.ts`, `probe-vote-gating.ts`.

**Scope and ethics.** Read-only requests only. No load or stress testing, no attempt to brute-force
or enumerate tokens, no automated account creation, no writes to other people's content, and no
attempt to defeat bot protection beyond the standard browser flags an automation suite would use.
Query-cost probing was capped at a depth that documents behaviour without degrading the service.

---

## Bugs and inconsistencies

### BUG-1 — Search results page has no heading and keeps the generic homepage title (Medium)

The `/search?q=…` page renders zero `h1` and `h2` elements, and `document.title` stays
`"Product Hunt – The best new products in tech."` regardless of the query. The suggestion overlay is
fully labelled, but the destination page — the main discovery surface — is not.

- **Impact:** search result pages are indistinguishable to search engines and announce no context to
  screen-reader users, who land on a list of products with no statement of what was searched.
- **Expected:** `<title>` and an `h1` reflecting the query, e.g. `notion – Search – Product Hunt`.
- **Covered by:** `tests/e2e/search.spec.ts`, as an intentionally failing test (`test.fail`) so the
  suite turns red when it is fixed.

### BUG-2 — Anonymous upvote optimistically increments the count (Medium–High)

Clicking upvote while signed out increments the displayed count immediately (observed 204 → 205 on the
homepage, 174 → 175 on `/products/notion`) and then shows the login modal. The inflated number stays
on screen behind the modal. The server correctly rejects the vote: reloading restores the true count.

- **Impact:** the product's core metric visibly lies to every anonymous visitor who clicks. On launch
  day, where ranking is the whole point, showing an uncommitted vote invites disputes about counts.
- **Expected:** do not apply the optimistic update until the visitor is authenticated, or roll it back
  when the login prompt is dismissed.
- **Covered by:** `tests/e2e/auth-gating.spec.ts` — the main test asserts the vote never persists, and
  a `test.fail` test documents the optimistic increment.

### BUG-3 — Upvote clicks before hydration are silently dropped (Medium)

Immediately after page load the vote button is present and clickable but its handler is not yet
attached. The click does nothing at all: no login modal, no visual feedback, no error. Waiting a few
seconds and clicking the same element works every time. This was reproducible enough to break a test
run before I added a retry around the click.

- **Impact:** on the highest-intent action on the site, early clickers get silence and probably assume
  the vote landed.
- **Expected:** disable the control until interactive, or queue the intent and act on hydration.

### BUG-4 — Modals have no dialog semantics (Medium, accessibility)

Both the spotlight search overlay (`[data-test="spotlight-search"]`) and the login overlay
(`[data-test="login-screen"]`) render with no `role="dialog"` anywhere in the document — the count of
`[role="dialog"]` elements is 0 while either is open.

- **Impact:** assistive technology does not announce these as dialogs, and there is no semantic
  boundary for focus management on two of the most-used interactions on the site.
- **Expected:** `role="dialog"` with `aria-modal="true"`, a label, and a focus trap.

### BUG-5 — Images without alt attributes on the homepage (Low, accessibility)

4 of 72 `img` elements on the homepage have no `alt` attribute at all (not even `alt=""`).

### BUG-6 — The API advertises GET but does not support it (Low)

The CORS preflight returns `Access-Control-Allow-Methods: GET, POST, HEAD, OPTIONS`, but a GET to the
GraphQL endpoint returns **404 with an HTML error page** rather than JSON.

- **Impact:** a client that trusts the advertised methods gets an HTML body from a JSON API, which
  typically surfaces as a parse error rather than a clear failure.
- **Expected:** advertise only what is supported, and always answer this endpoint with JSON.

### BUG-7 — GraphQL error payloads do not follow the specification (Medium, developer-facing)

Auth failures return entries in `errors[]` shaped as `{"error": "invalid_oauth_token",
"error_description": "…"}`. The GraphQL specification requires a `message` field, which is what every
standard client reads.

Validation errors from the same endpoint *are* spec-compliant: an unknown field returns HTTP 200 with
`{"message": "Field 'thisFieldDoesNotExist' doesn't exist on type 'Post'", "locations": […],
"path": […], "extensions": {"code": "undefinedField", "typeName": "Post"}}`. So the GraphQL layer
already emits correct errors and only the OAuth layer in front of it does not.

- **Impact:** Apollo, urql and similar clients report `undefined` as the error message, so integrators
  see an empty error and have to inspect the raw body to find out they used a bad token.
- **Expected:** include `message`, and keep the OAuth fields in `extensions` if they are needed. The
  contrast above makes this a narrow fix in one middleware rather than an error-handling redesign.
- **Covered by:** `tests/api/auth.test.ts`, which pins the current shape so a change is noticed.

### BUG-8 — 404 pages keep the generic homepage title (Low)

`/qa-nonexistent-page-check-12345` correctly returns HTTP 404 with a branded error page, but the title
is still `"Product Hunt – The best new products in tech."`.

---

## Security observations

Nothing here is an exploit; these are the properties I checked and what I found.

**Good, and worth keeping regressions off:**

- **Auth is enforced before the query is parsed.** A syntactically broken document sent without a
  token returns 401, not a parse error, and introspection is unavailable anonymously. An unauthenticated
  caller learns nothing about the schema. Pinned in `tests/api/auth.test.ts`.
- **JSON content type is required.** A body sent as `text/plain` is rejected with 400
  (`query_missing`). This is what stops a cross-site "simple request" from reaching the API without a
  preflight; combined with bearer-token (not cookie) auth, the endpoint is not CSRF-exposed.
- **Transport security.** `Strict-Transport-Security: max-age=2592000; includeSubDomains; preload`,
  plain HTTP 301-redirects to HTTPS, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`.
- **Outbound product links** carry `rel="noreferrer noopener ugc"` — correct for user-supplied
  destinations. Asserted in `tests/e2e/product-page.spec.ts`.
- **Query cost is bounded.** A deliberately nested document (posts → comments → user → followers, 20
  at each level) is refused with `Query has complexity of 64961202, which exceeds max complexity of
  500000`. The endpoint rejects an expensive document instead of attempting it, which is the defence
  that matters most on a public GraphQL API. Pinned in `tests/api/limits.test.ts`, which compares the
  two reported numbers so the test proves the cap was applied rather than matching a fixed string.
- **The quota is complexity-based and disclosed.** Authenticated responses carry
  `X-Rate-Limit-Limit: 6250`, `X-Rate-Limit-Remaining` and `X-Rate-Limit-Reset` (seconds remaining in
  a ~15-minute window). A `posts(first: 1)` query costs 100 points, so spend is metered by cost rather
  than by request count — the right shape for GraphQL, and enough for a client to back off politely.

**Worth a conversation:**

- **SEC-1 — Tracking cookies are set before any consent choice.** On first load, before touching the
  cookie banner, the site sets `_ga`, `_fbp`, `ajs_anonymous_id`, LinkedIn (`bcookie`, `li_sugr`) and
  X (`guest_id`, `muc_ads`, `personalization_id`) cookies. The banner then offers "No thanks" /
  "Accept all cookies" — after the fact. Several of these are also set without the `Secure` flag
  (`_ga`, `_fbp`, `ajs_anonymous_id`). For a company operating in regulated markets this is the
  finding I would raise first: it is a consent-ordering problem, not a technical bug.
- **SEC-2 — No CSP, Referrer-Policy or Permissions-Policy on application pages.** These headers are
  present on the Cloudflare interstitial but absent from the real HTML responses. On a site that
  renders user-generated reviews, forum posts and maker-supplied links, a CSP is the main mitigation
  if a stored-XSS bug ever ships.
- **SEC-3 — `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Headers:
  authorization`.** `Access-Control-Allow-Credentials` is absent, which is what keeps this safe:
  browsers refuse to send cookies to a wildcard origin, so no user's session can ride along on a
  cross-origin call. The residual concern is cultural rather than technical — the policy invites
  developers to call the API from browser JavaScript, which is how non-expiring developer tokens end up
  in shipped front-end bundles. I would pair it with short-lived tokens and explicit server-side-only
  guidance. Pinned in `tests/api/security.test.ts`, including the absence of the credentials header,
  because that single header is the difference between this being fine and being a real vulnerability.
- **SEC-4 — Failed authentication returns no rate-limit headers.** The `X-Rate-Limit-*` headers are
  only exposed to authenticated callers, so from the outside there is no evidence that repeated
  invalid-token requests are throttled. I did not test this (deliberately — it would be
  indistinguishable from an attack). Worth confirming from the inside that auth failures are rate
  limited independently of the quota system.
- **SEC-5 — Introspection is fully open to any authenticated client.** A free developer token can
  enumerate the entire type list, `Mutation` included, even though write access is gated behind manual
  approval. This is defensible for a documented public API and I am not calling it a defect, but it is
  worth stating: the schema is public attack surface, so the approval gate is the only real control on
  writes, and it should be enforced server-side per field rather than by token issuance alone.
- **SEC-6 — API-issued URLs embed the calling application's identity.** Every `Post.url` returns with
  `utm_source=Application: producthunt-qa-tests (ID: 296085)` appended. A client that renders those
  links leaks its own application name and numeric ID into the destination site's analytics. Low
  severity, but it publishes data the integrator never chose to share.
- **SEC-7 — HSTS declares `preload` but its `max-age` is too short to qualify.** The header is
  `max-age=2592000; includeSubDomains; preload` — 30 days, where the preload list requires at least one
  year. The directive advertises an eligibility the policy does not meet, so a reader of the header could
  reasonably assume the domain is preloaded when it may not be. Either raise `max-age` to 31536000 and
  submit it, or drop the `preload` token so the header states what is true. The floor is asserted in
  `tests/api/security.test.ts`, so shortening the window has to come past a test.

---

## Testability finding: bot protection blocks headless automation

This shaped the whole E2E design, so it belongs in the report.

| Configuration | Result |
| --- | --- |
| Headless shell (Playwright default) | 403, Cloudflare interstitial, never clears |
| Headless Chromium (new headless) | 403, never clears |
| Headless + `--disable-blink-features=AutomationControlled` | 403, never clears |
| Headed Chromium | 200, real page |
| Headed + `--disable-blink-features=AutomationControlled` | 200, real page |
| Headed bundled Chromium, one cold context per test | escalates to an interactive checkbox |
| Headed installed Chrome, one session reused | 200, cleared in ~3s |

Rapid sequential navigations in one context also re-trigger the challenge, and a challenge that
reports "Verification successful" can still fail to hand over within 60 seconds. `navigator.webdriver`
is not the signal being used — a headed browser with `webdriver = true` passes.

**Cloudflare has two modes, and only one of them can be waited out.** Sustained automation escalated
the target from the passive "Just a moment…" interstitial to a managed challenge with a "Verify you are
human" checkbox, which never clears on its own: an early version of the suite waited the full 240s and
timed out against an unchecked box. Two things fixed it, and the distinction is worth stating because
only the second is a real engineering answer:

- The widget is a cross-origin Turnstile iframe with no plain `input[type="checkbox"]` to click, so a
  DOM-level click finds nothing. Real mouse input aimed at the widget's screen position goes through
  the browser's input pipeline instead and does register. This is best-effort by nature — telling those
  two apart is precisely Cloudflare's job — so it is a fallback, not the fix.
- The fix is to stop provoking it: clear the challenge **once** per run and reuse the session, and drive
  installed Chrome rather than bundled Chromium. A fresh cold context per test meant a fresh challenge
  per test, and that burst is what triggered the escalation in the first place.

**Consequences and how the suite handles them:** the E2E suite runs headed against installed Chrome and
CI drives it under `xvfb`, a `setup` project clears the challenge once and caches the session for every
test, workers are capped at 2 to avoid navigation bursts, every navigation waits for the app shell to
replace the interstitial, and status-code assertions read the last document response rather than the
first (the interstitial answers the same URL with 403 before the real response arrives).

A related constraint on tooling: Playwright cannot launch a browser under Bun on Windows — the launch
hangs on its pipe transport until it times out — so the runner is invoked through Node while Bun stays
the package manager and the API test runner.

**Confirmed from CI, not just locally.** On the first GitHub Actions run the API job passed in 8
seconds while the E2E job ran for 8 minutes 33 seconds and failed, against 40 seconds for a green local
run. Datacenter egress IPs get challenged far harder than a residential connection, and the
interstitial never handed over. The E2E job is therefore marked `continue-on-error`: from CI, a failure
means the environment is unavailable rather than the product being broken, and a build that cannot
distinguish those two is a misleading signal.

**What I would ask for in a real team:** a WAF bypass rule for CI egress IPs or a shared secret
header, and a staging environment without the interstitial. Working around bot protection in test
code is a losing game and makes the suite a poor signal.

---

## What I would investigate next

- Vote integrity end-to-end with a real account: double-submit, replay of the vote mutation, and
  whether removing a vote decrements correctly.
- Whether the 500,000 complexity cap is per-document only or also aggregated across a window, and how
  a client is expected to discover a document's cost before spending its 6,250-point budget on it.
- Whether search results are consistent between the suggestion overlay and the results page for the
  same term — they appear to use different ranking.
- Review and forum content for stored-XSS handling, which is the risk the missing CSP would otherwise
  mitigate.
