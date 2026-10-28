/**
 * @file create-query-client.ts
 * @description Default TanStack Query configuration for the app. The retry policy encodes one
 * rule: never retry a request the server has already definitively answered with a 4xx.
 */
import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/services/api-error";

/** Retries allowed for transient failures (network errors and 5xx). */
const MAX_TRANSIENT_RETRIES = 2;

/**
 * Decides whether a failed query is retried.
 *
 * @param failureCount - Failures so far for this query.
 * @param error - The thrown error.
 * @returns False for 4xx API errors (retrying cannot change the answer), otherwise true until
 * the retry budget is spent.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < MAX_TRANSIENT_RETRIES;
}

/**
 * Creates the app's QueryClient.
 *
 * @returns A client with a 30 second freshness window, no refetch on window focus (the
 * real-time layer keeps data current), and the {@link shouldRetry} policy.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: shouldRetry },
    },
  });
}
