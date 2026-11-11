/**
 * @file notifier.types.ts
 * @description The notification abstraction components depend on. It hides the toast library
 * behind a small interface (Dependency Inversion), so the library can be swapped and tests can
 * assert on notifications without rendering a toaster.
 */

/** Fire-and-forget user notifications. */
export interface Notifier {
  /** Confirms that something worked, for example "Workspace created". */
  success(message: string): void;
  /** Neutral information that is not a result of a failed action. */
  info(message: string): void;
  /**
   * Reports a failure. Accepts any thrown value: an `ApiError` contributes its user-safe
   * message, anything else falls back to a generic message so internals never leak to the UI.
   */
  error(error: unknown): void;
}
