/**
 * @file api-error.test.ts
 * @description Unit tests for the normalised API error type and its type guard.
 */
import { describe, expect, it } from "vitest";
import { ApiError, isApiError } from "@/shared/services/api-error";

describe("ApiError", () => {
  it("carries the status, code, message and details", () => {
    const error = new ApiError(403, "FORBIDDEN", "No.", { need: "ADMIN" });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error).toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "No.",
      details: { need: "ADMIN" },
    });
  });
});

describe("isApiError", () => {
  it("recognises ApiError and rejects everything else", () => {
    expect(isApiError(new ApiError(500, "X", "x"))).toBe(true);
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError({ code: "X" })).toBe(false);
  });
});
