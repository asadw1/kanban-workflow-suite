/**
 * @file sonner-notifier.ts
 * @description Sonner-backed implementation of {@link Notifier}, plus the helper that turns any
 * thrown value into text that is safe to show to a user.
 */
import { toast } from "sonner";
import { isApiError } from "@/shared/services/api-error";
import type { Notifier } from "@/shared/services/notifier.types";

/** Shown when a failure carries no user-safe message. */
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * Converts a thrown value into user-safe text. Only `ApiError` messages are trusted, because the
 * API contract guarantees they are safe to display; arbitrary `Error` messages may contain
 * internals (stack details, SQL, URLs), so they are replaced by a generic message.
 *
 * @param error - Any thrown value.
 * @returns Text suitable for a toast.
 */
export function getErrorMessage(error: unknown): string {
  return isApiError(error) && error.message ? error.message : GENERIC_ERROR_MESSAGE;
}

/** The subset of Sonner's API this adapter calls; injectable so tests need no DOM toaster. */
export interface ToastApi {
  success(message: string): unknown;
  info(message: string): unknown;
  error(message: string): unknown;
}

/** {@link Notifier} that shows Sonner toasts. */
export class SonnerNotifier implements Notifier {
  /** @param api - Toast functions; defaults to Sonner's global `toast`. */
  constructor(private readonly api: ToastApi = toast) {}

  success(message: string): void {
    this.api.success(message);
  }

  info(message: string): void {
    this.api.info(message);
  }

  error(error: unknown): void {
    this.api.error(getErrorMessage(error));
  }
}
