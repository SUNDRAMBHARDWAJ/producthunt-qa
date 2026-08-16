export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
}

export interface Connection<T> {
  edges: Array<{ cursor: string; node: T }>;
  pageInfo: PageInfo;
  totalCount?: number;
}

export interface User {
  id: string;
  name: string;
  username: string;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  followersCount: number;
  postsCount: number;
}

export interface Post {
  id: string;
  name: string;
  tagline: string;
  slug: string;
  url: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  featuredAt: string | null;
  thumbnail: { url: string } | null;
  user: User | null;
  topics: Connection<Pick<Topic, "id" | "name" | "slug">>;
}

export type PostsOrder = "RANKING" | "NEWEST" | "VOTES" | "FEATURED_AT";

export interface PostsData {
  posts: Connection<Post>;
}

export interface PostData {
  post: Post | null;
}

export interface TopicData {
  topic: Topic | null;
}

export interface ViewerData {
  viewer: { user: User } | null;
}
