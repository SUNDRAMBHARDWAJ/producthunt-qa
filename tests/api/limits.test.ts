import { describe, expect, test } from "bun:test";
import { api, rateLimit } from "../../src/api/client";
import { NESTED_COST_QUERY } from "../../src/api/queries";
import { hasApiToken } from "../../src/config/env";

describe.skipIf(!hasApiToken)("Limits", () => {
  test("refuses a document over the complexity cap and still reports quota spend", async () => {
    const result = await api.query(NESTED_COST_QUERY);

    expect(result.status).toBe(200);
    expect(result.body.data ?? null).toBeNull();

    const message = result.body.errors?.[0]?.message ?? "";
    const costs = message.match(/complexity of (\d+), which exceeds max complexity of (\d+)/);
    expect(costs).not.toBeNull();

    const [, cost, cap] = costs!;
    expect(Number(cost)).toBeGreaterThan(Number(cap));
    expect(Number(cap)).toBeGreaterThan(0);

    const quota = rateLimit(result.headers);
    expect(quota.limit).toBeGreaterThan(0);
    expect(quota.remaining).not.toBeNull();
    expect(quota.resetSeconds).not.toBeNull();
  });
});
