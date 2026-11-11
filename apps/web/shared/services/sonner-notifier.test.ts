/**
 * @file sonner-notifier.test.ts
 * @description Tests the notifier adapter and the error-to-message mapping with a fake toast API.
 */
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/services/api-error";
import {
  GENERIC_ERROR_MESSAGE,
  SonnerNotifier,
  getErrorMessage,
} from "@/shared/services/sonner-notifier";

const fakeApi = () => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() });

describe("getErrorMessage", () => {
  it("trusts the message of an ApiError", () => {
    expect(getErrorMessage(new ApiError(403, "FORBIDDEN", "You cannot do that"))).toBe(
      "You cannot do that",
    );
  });

  it("hides the message of non-API errors", () => {
    expect(getErrorMessage(new Error("SELECT * FROM secrets failed"))).toBe(GENERIC_ERROR_MESSAGE);
    expect(getErrorMessage("boom")).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("falls back when an ApiError has an empty message", () => {
    expect(getErrorMessage(new ApiError(500, "INTERNAL", ""))).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe("SonnerNotifier", () => {
  it("forwards success and info messages", () => {
    const api = fakeApi();
    const notifier = new SonnerNotifier(api);
    notifier.success("Saved");
    notifier.info("FYI");
    expect(api.success).toHaveBeenCalledWith("Saved");
    expect(api.info).toHaveBeenCalledWith("FYI");
  });

  it("shows errors through the safe message mapping", () => {
    const api = fakeApi();
    new SonnerNotifier(api).error(new ApiError(409, "CONFLICT", "Slug already taken"));
    expect(api.error).toHaveBeenCalledWith("Slug already taken");
  });

  it("defaults to the real Sonner toast", () => {
    expect(() => new SonnerNotifier()).not.toThrow();
  });
});
