import { expect } from "bun:test";
import type { Post } from "../../../src/api/types";

export function expectValidPost(post: Post): void {
  expect(post.id).toBeString();
  expect(post.id.length).toBeGreaterThan(0);

  expect(post.name.trim().length).toBeGreaterThan(0);
  expect(post.tagline).toBeString();
  expect(post.slug.trim().length).toBeGreaterThan(0);

  expect(post.votesCount).toBeInteger();
  expect(post.votesCount).toBeGreaterThanOrEqual(0);
  expect(post.commentsCount).toBeInteger();
  expect(post.commentsCount).toBeGreaterThanOrEqual(0);

  expect(post.url).toStartWith("https://www.producthunt.com/");

  const createdAt = new Date(post.createdAt);
  expect(Number.isNaN(createdAt.getTime())).toBe(false);
  expect(createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);

  if (post.thumbnail) expect(post.thumbnail.url).toStartWith("http");
  if (post.user) expect(post.user.username.trim().length).toBeGreaterThan(0);
}
