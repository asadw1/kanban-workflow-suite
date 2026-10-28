/**
 * @file api-error.ts
 * @description The single error type thrown by the data layer. It mirrors the API
 * `ErrorResponse` contract (`{ message, code, details? }`) plus the HTTP status, so UI code
 * switches on stable `code` values and never inspects raw responses.
 */

/** Code used when the request never reached the API (offline, DNS, CORS, server down). */
export const NETWORK_ERROR_CODE = "NETWORK_ERROR";

/** Code used when the API answered 2xx but the body did not match its shared Zod schema. */
export const INVALID_RESPONSE_CODE = "INVALID_RESPONSE";

/** A failed API interaction, normalised to the server error contract. */
export class ApiError extends Error {
  /**
   * @param status - HTTP status, or 0 when no response was received.
   * @param code - Stable machine-readable code from the API (or a client-side code above).
   * @param message - Human-readable text, safe to show to the user.
   * @param details - Optional structured context from the API (for example Zod issues).
   */
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Type guard for {@link ApiError}, usable across module boundaries and in `catch` blocks.
 *
 * @param error - Any thrown value.
 * @returns True when `error` is an {@link ApiError}.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
