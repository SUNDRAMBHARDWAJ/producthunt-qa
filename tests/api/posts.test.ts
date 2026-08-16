import { describe, expect, test } from "bun:test";
import { api } from "../../src/api/client";
import { POST_BY_SLUG_QUERY, POSTS_QUERY } from "../../src/api/queries";
import type { PostData, PostsData } from "../../src/api/types";
import { hasApiToken } from "../../src/config/env";
import { expectValidPost } from "./support/post-assertions";

describe.skipIf(!hasApiToken)("Posts feed", () => {
  test("returns the requested page size with a valid post shape", async () => {
    const data = await api.expectData<PostsData>(POSTS_QUERY, { first: 5, order: "VOTES" });

    expect(data.posts.edges).toHaveLength(5);
    for (const { node, cursor } of data.posts.edges) {
      expect(cursor.length).toBeGreaterThan(0);
      expectValidPost(node);
    }

    const votes = data.posts.edges.map((edge) => edge.node.votesCount);
    expect(votes).toEqual([...votes].sort((a, b) => b - a));
  });

  test("paginates with cursors without repeating or dropping posts", async () => {
    const firstPage = await api.expectData<PostsData>(POSTS_QUERY, { first: 3 });
    expect(firstPage.posts.pageInfo.hasNextPage).toBe(true);
    expect(firstPage.posts.pageInfo.endCursor).toBeString();

    const secondPage = await api.expectData<PostsData>(POSTS_QUERY, {
      first: 3,
      after: firstPage.posts.pageInfo.endCursor,
    });

    const firstIds = firstPage.posts.edges.map((edge) => edge.node.id);
    const secondIds = secondPage.posts.edges.map((edge) => edge.node.id);

    expect(secondIds).toHaveLength(3);
    expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    expect(secondPage.posts.pageInfo.hasPreviousPage).toBe(true);
  });

  test("looks up a single post by slug and returns null for an unknown one", async () => {
    const feed = await api.expectData<PostsData>(POSTS_QUERY, { first: 1 });
    const expected = feed.posts.edges[0]?.node;
    expect(expected).toBeDefined();

    const found = await api.expectData<PostData>(POST_BY_SLUG_QUERY, { slug: expected!.slug });
    expect(found.post).not.toBeNull();
    expect(found.post!.id).toBe(expected!.id);
    expect(found.post!.slug).toBe(expected!.slug);
    expectValidPost(found.post!);

    const missing = await api.query<PostData>(POST_BY_SLUG_QUERY, {
      slug: "qa-slug-that-should-never-exist-12345",
    });
    expect(missing.status).toBeLessThan(500);
    expect(missing.body.data?.post ?? null).toBeNull();
  });
});
