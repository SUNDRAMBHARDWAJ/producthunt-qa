/** Evidence for docs/findings.md. bun run scripts/explore-api.ts */
import { ProductHuntClient, rateLimit } from "../src/api/client";
import { config, hasApiToken } from "../src/config/env";
import {
  INTROSPECTION_QUERY,
  INVALID_FIELD_QUERY,
  MALFORMED_QUERY,
  NESTED_COST_QUERY,
  POSTS_QUERY,
  VIEWER_QUERY,
} from "../src/api/queries";

const anonymous = new ProductHuntClient({ token: null });
const authenticated = new ProductHuntClient();

const INTERESTING_HEADERS = [
  "content-type",
  "x-rate-limit-limit",
  "x-rate-limit-remaining",
  "x-rate-limit-reset",
  "access-control-allow-origin",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "x-request-id",
  "server",
];

async function probe(label: string, client: ProductHuntClient, query: string, variables?: Record<string, unknown>) {
  console.log(`\n=== ${label} ===`);
  try {
    const result = await client.query(query, variables);
    console.log(`status: ${result.status}  (${Math.round(result.durationMs)} ms)`);

    for (const name of INTERESTING_HEADERS) {
      const value = result.headers.get(name);
      if (value !== null) console.log(`  ${name}: ${value}`);
    }
    console.log(`rate limit: ${JSON.stringify(rateLimit(result.headers))}`);
    console.log(`body: ${result.rawBody.slice(0, 600)}`);
  } catch (error) {
    console.log(`threw: ${(error as Error).message}`);
  }
}

async function probeMethodAndContentType() {
  console.log("\n=== transport: GET and wrong content-type ===");
  for (const [label, init] of [
    ["GET with query string", { method: "GET" } as RequestInit],
    [
      "POST as text/plain",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ query: "{ posts(first: 1) { edges { node { id } } } }" }),
      } as RequestInit,
    ],
  ] as const) {
    try {
      const response = await fetch(config.apiUrl, init);
      console.log(`  ${label}: ${response.status} ${(await response.text()).slice(0, 200)}`);
    } catch (error) {
      console.log(`  ${label}: threw ${(error as Error).message}`);
    }
  }
}

console.log(`endpoint: ${config.apiUrl}`);
console.log(`token configured: ${hasApiToken}`);

await probe("anonymous: simple posts query", anonymous, POSTS_QUERY, { first: 1 });
await probe("invalid token: simple posts query", new ProductHuntClient({ token: "not-a-real-token" }), POSTS_QUERY, {
  first: 1,
});
await probe("anonymous: malformed document", anonymous, MALFORMED_QUERY);
await probe("anonymous: introspection", anonymous, INTROSPECTION_QUERY);
await probeMethodAndContentType();

if (hasApiToken) {
  await probe("authenticated: posts", authenticated, POSTS_QUERY, { first: 2 });
  await probe("authenticated: viewer", authenticated, VIEWER_QUERY);
  await probe("authenticated: unknown field", authenticated, INVALID_FIELD_QUERY);
  await probe("authenticated: introspection", authenticated, INTROSPECTION_QUERY);
  await probe("authenticated: nested cost", authenticated, NESTED_COST_QUERY);
} else {
  console.log("\nSkipping authenticated probes: set PH_API_TOKEN in .env to run them.");
}
