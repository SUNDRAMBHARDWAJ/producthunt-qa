import { describe, expect, test } from "bun:test";
import { anonymousApi } from "../../src/api/client";
import { POSTS_QUERY } from "../../src/api/queries";

describe("Security posture", () => {
  test("sends the hardening headers a browser client depends on", async () => {
    const { headers } = await anonymousApi.query(POSTS_QUERY, { first: 1 });

    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toMatch(/SAMEORIGIN|DENY/i);

    const hsts = headers.get("strict-transport-security") ?? "";
    expect(hsts).toContain("includeSubDomains");

    const maxAgeSeconds = Number(hsts.match(/max-age=(\d+)/)?.[1] ?? 0);
    expect(maxAgeSeconds).toBeGreaterThanOrEqual(2_592_000);
  });

  test("CORS opens reads to any origin but cannot carry credentials", async () => {
    const { status, headers } = await anonymousApi.preflight("https://qa-probe.example");

    expect(status).toBeLessThan(300);
    expect(headers.get("access-control-allow-origin")).toBe("*");
    expect(headers.get("access-control-allow-credentials")).toBeNull();
    expect(headers.get("access-control-allow-headers")?.toLowerCase()).toContain("authorization");
    expect(headers.get("access-control-expose-headers")?.toLowerCase()).toContain(
      "x-rate-limit-remaining",
    );
    expect(headers.get("access-control-allow-methods")).toContain("POST");
  });
});
