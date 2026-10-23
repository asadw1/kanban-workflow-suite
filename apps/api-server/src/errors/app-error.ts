/**
 * @file app-error.ts
 * @description Domain error type that services and middleware throw to signal an expected,
 * client-visible failure. The central error handler turns it into the standard
 * `{ message, code, details? }` response; anything else is treated as an unexpected 500.
 */

/**
 * An expected failure carrying the HTTP status and stable machine-readable code the client
 * should see (for example 403 `FORBIDDEN` from RBAC checks).
 */
export class AppError extends Error {
  /**
   * @param statusCode - HTTP status to respond with (4xx for caller mistakes).
   * @param code - Stable identifier clients may switch on; never changes once shipped.
   * @param message - Human-readable text; safe to show to the caller.
   * @param details - Optional structured context; must not contain secrets or internals.
   */
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}
