import { config } from "../config/env";

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphQLBody<T> {
  data?: T | null;
  errors?: GraphQLError[];
  error?: string;
  error_description?: string;
}

export interface GraphQLResult<T> {
  status: number;
  headers: Headers;
  body: GraphQLBody<T>;
  rawBody: string;
  durationMs: number;
}

export interface ClientOptions {
  endpoint?: string;
  token?: string | null;
  timeoutMs?: number;
}

// Does not throw on HTTP/GraphQL errors — those payloads are what several tests assert on.
export class ProductHuntClient {
  private readonly endpoint: string;
  private readonly token: string | null;
  private readonly timeoutMs: number;

  constructor(options: ClientOptions = {}) {
    this.endpoint = options.endpoint ?? config.apiUrl;
    this.token = options.token === undefined ? config.apiToken : options.token;
    this.timeoutMs = options.timeoutMs ?? config.requestTimeoutMs;
  }

  async query<T>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResult<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const startedAt = performance.now();
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const rawBody = await response.text();
    const durationMs = performance.now() - startedAt;

    let body: GraphQLBody<T>;
    try {
      body = JSON.parse(rawBody) as GraphQLBody<T>;
    } catch {
      body = { errors: [{ message: `Non-JSON response (${response.status})` }] };
    }

    return { status: response.status, headers: response.headers, body, rawBody, durationMs };
  }

  async preflight(origin: string): Promise<{ status: number; headers: Headers }> {
    const response = await fetch(this.endpoint, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    return { status: response.status, headers: response.headers };
  }

  async expectData<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const result = await this.query<T>(query, variables);

    if (result.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${result.status}: ${result.rawBody.slice(0, 300)}`);
    }
    if (result.body.errors?.length) {
      throw new Error(`GraphQL errors: ${result.body.errors.map((e) => e.message).join("; ")}`);
    }
    if (!result.body.data) {
      throw new Error(`Response contained no data: ${result.rawBody.slice(0, 300)}`);
    }

    return result.body.data;
  }
}

export const api = new ProductHuntClient();
export const anonymousApi = new ProductHuntClient({ token: null });

export function rateLimit(headers: Headers) {
  const read = (name: string) => {
    const value = headers.get(name);
    return value === null ? null : Number(value);
  };

  return {
    limit: read("x-rate-limit-limit"),
    remaining: read("x-rate-limit-remaining"),
    resetSeconds: read("x-rate-limit-reset"),
  };
}
