import { describe, expect, test } from "bun:test";
import { config } from "../../src/config/env";

describe("Transport", () => {
  test("only accepts a JSON body, which also blocks simple-request CSRF", async () => {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ query: "{ posts(first: 1) { edges { node { id } } } }" }),
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("query_missing");
  });

  test("upgrades plain HTTP to HTTPS instead of serving the API insecurely", async () => {
    const insecureUrl = config.apiUrl.replace("https://", "http://");

    const response = await fetch(insecureUrl, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
    });

    expect([301, 302, 307, 308]).toContain(response.status);
    expect(response.headers.get("location")).toStartWith("https://");
  });
});
