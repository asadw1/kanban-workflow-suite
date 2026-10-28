/**
 * @file http-client.types.ts
 * @description The abstraction every data service depends on (Dependency Inversion). Services
 * and hooks receive an `HttpClient`, never `fetch`, so they can be unit tested with a fake and
 * the transport can change without touching them.
 */
import type { z } from "zod";

/** HTTP verbs the API uses. */
export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** A request to the API. `path` is relative to the API base URL and starts with `/`. */
export interface HttpRequest {
  method: HttpMethod;
  path: string;
  /** Query-string parameters; `undefined` values are omitted. */
  query?: Record<string, string | number | undefined>;
  /** JSON body, serialised by the client. */
  body?: unknown;
}

/** Typed access to the API. */
export interface HttpClient {
  /**
   * Sends a request and validates the JSON response against a shared Zod schema.
   * Validation only: the parsed value is returned as the API sent it, never reshaped.
   *
   * @param request - The request to send.
   * @param schema - Shared-types schema describing the response body.
   * @returns The parsed response body.
   * @throws ApiError for non-2xx responses, network failures and schema mismatches.
   */
  request<S extends z.ZodTypeAny>(request: HttpRequest, schema: S): Promise<z.output<S>>;

  /**
   * Sends a request whose successful response has no body (for example 204).
   *
   * @param request - The request to send.
   * @returns Resolves on success.
   * @throws ApiError for non-2xx responses and network failures.
   */
  send(request: HttpRequest): Promise<void>;
}
