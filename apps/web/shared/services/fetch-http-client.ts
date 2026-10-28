/**
 * @file fetch-http-client.ts
 * @description `HttpClient` implementation on top of `fetch`. It attaches the in-memory bearer
 * token, always sends credentials (the refresh cookie lives on the API origin), parses the
 * standard error body, validates success bodies with shared Zod schemas, and transparently
 * recovers from an expired access token with one refresh-and-retry.
 */
import type { z } from "zod";
import { ErrorResponseSchema } from "shared-types";
import { ApiError, INVALID_RESPONSE_CODE, NETWORK_ERROR_CODE } from "@/shared/services/api-error";
import type { HttpClient, HttpRequest } from "@/shared/services/http-client.types";

/** Dependencies of {@link FetchHttpClient}. */
export interface FetchHttpClientOptions {
  /** API origin without a trailing slash, for example `http://localhost:4000`. */
  baseUrl: string;
  /** Returns the current access token, or null when signed out. */
  getAccessToken: () => string | null;
  /**
   * Obtains a fresh access token (single-flight and cross-tab safe, see SessionManager).
   * Resolves to null when the session is gone.
   */
  refreshAccessToken: () => Promise<string | null>;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/** Fetch-based API client. */
export class FetchHttpClient implements HttpClient {
  private readonly fetchImpl: typeof fetch;

  /** @param options - Collaborators; see {@link FetchHttpClientOptions}. */
  constructor(private readonly options: FetchHttpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  /** @inheritdoc */
  async request<S extends z.ZodTypeAny>(request: HttpRequest, schema: S): Promise<z.output<S>> {
    const response = await this.execute(request);
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      // A contract violation is a bug in the API or the schema; fail loudly, never coerce.
      throw new ApiError(
        response.status,
        INVALID_RESPONSE_CODE,
        "The server response did not match the expected format.",
        parsed.error.issues,
      );
    }
    return parsed.data;
  }

  /** @inheritdoc */
  async send(request: HttpRequest): Promise<void> {
    await this.execute(request);
  }

  /**
   * Performs the request with at most one refresh-and-retry on an expired access token.
   *
   * @param request - Request to send.
   * @param canRetry - False on the retry itself, so a second 401 cannot loop.
   * @returns The successful response.
   * @throws ApiError for any failure.
   */
  private async execute(request: HttpRequest, canRetry = true): Promise<Response> {
    const response = await this.fetchOnce(request);
    if (response.ok) return response;

    const error = await this.toApiError(response);
    if (canRetry && error.code === "UNAUTHENTICATED") {
      const token = await this.options.refreshAccessToken();
      if (token) return this.execute(request, false);
    }
    throw error;
  }

  /** Issues one HTTP call, mapping transport failures to {@link ApiError}. */
  private async fetchOnce(request: HttpRequest): Promise<Response> {
    const headers: Record<string, string> = { accept: "application/json" };
    const token = this.options.getAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
    if (request.body !== undefined) headers["content-type"] = "application/json";

    try {
      return await this.fetchImpl(this.buildUrl(request), {
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        // The refresh cookie belongs to the API origin; without this it is never sent.
        credentials: "include",
      });
    } catch {
      throw new ApiError(0, NETWORK_ERROR_CODE, "Unable to reach the server.");
    }
  }

  private buildUrl(request: HttpRequest): string {
    const url = new URL(request.path, this.options.baseUrl);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  /** Reads the standard error body; falls back to a generic error for non-contract bodies. */
  private async toApiError(response: Response): Promise<ApiError> {
    try {
      const body = ErrorResponseSchema.parse(await response.json());
      return new ApiError(response.status, body.code, body.message, body.details);
    } catch {
      // Proxies and crashes can return HTML or an empty body instead of the error contract.
      return new ApiError(response.status, "UNKNOWN_ERROR", "Something went wrong.");
    }
  }
}
