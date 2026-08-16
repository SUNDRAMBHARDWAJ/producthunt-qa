import { describe, expect, test } from "bun:test";
import { ProductHuntClient } from "../../src/api/client";
import { MALFORMED_QUERY, POSTS_QUERY } from "../../src/api/queries";
import type { PostsData } from "../../src/api/types";

describe("Authentication", () => {
  test("rejects an unauthenticated request and returns no data", async () => {
    const client = new ProductHuntClient({ token: null });

    const result = await client.query<PostsData>(POSTS_QUERY, { first: 1 });

    expect(result.status).toBe(401);
    expect(result.body.data).toBeNull();
    expect(result.body.errors?.[0]).toMatchObject({ error: "invalid_oauth_token" });
  });

  test("rejects a syntactically valid but bogus bearer token", async () => {
    const client = new ProductHuntClient({ token: "ph_not_a_real_token_0123456789" });

    const result = await client.query<PostsData>(POSTS_QUERY, { first: 1 });

    expect(result.status).toBe(401);
    expect(result.body.data).toBeNull();
    expect(result.rawBody).not.toContain("expired");
    expect(result.rawBody.toLowerCase()).not.toContain("user_id");
  });

  test("authenticates before parsing the document, so unauthenticated clients learn nothing about the schema", async () => {
    const client = new ProductHuntClient({ token: null });

    const result = await client.query(MALFORMED_QUERY);

    expect(result.status).toBe(401);
    expect(result.rawBody).not.toContain("Syntax Error");
  });
});
