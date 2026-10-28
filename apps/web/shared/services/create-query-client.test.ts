/**
 * @file create-query-client.test.ts
 * @description Tests the retry policy and the client defaults.
 */
import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/services/api-error";
import { createQueryClient, shouldRetry } from "@/shared/services/create-query-client";

describe("shouldRetry", () => {
  it("never retries a definitive 4xx answer", () => {
    expect(shouldRetry(0, new ApiError(403, "FORBIDDEN", "no"))).toBe(false);
    expect(shouldRetry(0, new ApiError(404, "NOT_FOUND", "gone"))).toBe(false);
  });

  it("retries network errors and 5xx twice, then stops", () => {
    for (const error of [new ApiError(0, "NETWORK_ERROR", "x"), new ApiError(500, "X", "x")]) {
      expect(shouldRetry(0, error)).toBe(true);
      expect(shouldRetry(1, error)).toBe(true);
      expect(shouldRetry(2, error)).toBe(false);
    }
  });

  it("treats unknown errors as transient", () => {
    expect(shouldRetry(0, new Error("boom"))).toBe(true);
  });
});

describe("createQueryClient", () => {
  it("applies the app defaults", () => {
    const options = createQueryClient().getDefaultOptions().queries;
    expect(options).toMatchObject({
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    });
  });
});
