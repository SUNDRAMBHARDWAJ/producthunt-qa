const POST_FIELDS = `
  id
  name
  tagline
  slug
  url
  votesCount
  commentsCount
  createdAt
  featuredAt
  thumbnail {
    url
  }
  user {
    id
    name
    username
  }
  topics(first: 3) {
    edges {
      node {
        id
        name
        slug
      }
    }
  }
`;

export const POSTS_QUERY = `
  query Posts($first: Int!, $after: String, $order: PostsOrder) {
    posts(first: $first, after: $after, order: $order) {
      edges {
        cursor
        node {
          ${POST_FIELDS}
        }
      }
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
        startCursor
      }
    }
  }
`;

export const POST_BY_SLUG_QUERY = `
  query PostBySlug($slug: String!) {
    post(slug: $slug) {
      ${POST_FIELDS}
    }
  }
`;

export const TOPIC_BY_SLUG_QUERY = `
  query TopicBySlug($slug: String!) {
    topic(slug: $slug) {
      id
      name
      slug
      followersCount
      postsCount
    }
  }
`;

export const VIEWER_QUERY = `
  query Viewer {
    viewer {
      user {
        id
        name
        username
      }
    }
  }
`;

export const INVALID_FIELD_QUERY = `
  query InvalidField {
    posts(first: 1) {
      edges {
        node {
          id
          thisFieldDoesNotExist
        }
      }
    }
  }
`;

export const MALFORMED_QUERY = `query Broken { posts(first: 1) { edges { node { id `;

export const INTROSPECTION_QUERY = `
  query Introspection {
    __schema {
      queryType {
        name
      }
      types {
        name
      }
    }
  }
`;

export const NESTED_COST_QUERY = `
  query NestedCost {
    posts(first: 20) {
      edges {
        node {
          id
          comments(first: 20) {
            edges {
              node {
                id
                user {
                  id
                  followers(first: 20) {
                    edges {
                      node {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;
