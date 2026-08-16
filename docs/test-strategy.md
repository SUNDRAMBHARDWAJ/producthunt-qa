# Test Strategy — Product Hunt

Written as if I were the sole QA engineer for this product.

**What the product is.** A public, SEO-driven discovery site plus a read-only GraphQL API used by
third parties. Launch day is the business: a product gets one shot at the daily leaderboard and votes
decide the ranking. Traffic is anonymous-heavy, content is user-generated, and the API is a public
integration surface.

## What matters, in order

| # | Risk | Why it ranks here |
| --- | --- | --- |
| 1 | Vote integrity and the auth boundary | Votes are the ranking currency. A vote recorded without an account, or lost from a real one, is unrecoverable reputational damage. |
| 2 | Launch feed correctness | Wrong or empty leaderboards harm makers and are visible to everyone at once. |
| 3 | API contract stability | Third-party clients break silently on field renames, pagination and error-shape changes. |
| 4 | Discovery: search, topics, product pages | Highest-traffic paths after the homepage, and the whole SEO funnel. |
| 5 | Availability under launch spikes | Traffic is spiky and predictable; degradation clusters on launch mornings. |
| 6 | Abuse resistance | Vote rings, review spam and scraping are ongoing threats, not one-offs. |

Deliberately lower: cosmetic styling, rare account settings, and anything behind a login I cannot
provision test accounts for.

## Approach

- **Contract-first on the API.** GraphQL tests are cheap and deterministic and catch the failures with
  the widest blast radius, so they own auth behaviour, pagination, ordering and error shape.
- **Few, high-value E2E journeys.** 5–8 scenarios over the paths that produce revenue and reputation,
  driven through the app's own `data-test` hooks with web-first assertions and no fixed waits. E2E
  answers "can a user still do this", not field-level validation.
- **Push detail down the pyramid.** Anything a unit or integration test could catch should not be E2E.
  Without repo access I approximate this by keeping E2E assertions behavioural.
- **Test data.** Production is the only environment available, so everything is read-only against
  long-lived fixtures (an established product, a stable topic) rather than today's launches. With repo
  access I would seed staging and add write-path coverage for voting, reviews and comments.

## Non-functional coverage I would own

Security (auth boundary, token handling, response headers, CORS, rate limiting, user-generated
content — this round's results are in `findings.md`); performance (k6 modelling a launch-morning spike
on the posts query, plus Core Web Vitals budgets); accessibility (axe in the E2E run, focused on the
modals and launch cards); and data quality (vote and comment aggregates reconciled between API and
page).

## CI and monitoring

Both suites run on every pull request and on a daily schedule, which doubles as cheap production
monitoring. API tests gate merges because they are fast and stable. E2E runs headed under a virtual
display — the site's bot protection rejects headless browsers — retries once, and publishes traces and
video on failure. Beyond CI: synthetics on the homepage and API from two regions, alerting on API error
rate, latency and rate-limit rejections.

## Risks and trade-offs I am accepting

Testing against production means the highest-risk flow, recording a vote as a signed-in user, is only
observable from the outside. Third-party bot protection makes E2E slower and less stable than it should
be; the right fix is a WAF bypass rule for CI, not cleverness in test code. Hand-written API types are
fine at this size but should become schema codegen as coverage grows.

**Done means:** both suites green, no new accessibility violations on touched pages, and every new
user-facing surface has at least one journey test plus API contract coverage. Bugs I cannot automate get
written up with reproduction steps instead of living in a conversation.
