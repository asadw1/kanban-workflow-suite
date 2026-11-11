/**
 * @file safe-redirect.test.ts
 * @description Tests the open-redirect guard with benign and hostile inputs.
 */
import { describe, expect, it } from "vitest";
import { isSafeInternalPath, sanitizeNextPath } from "@/shared/utils/safe-redirect";

describe("isSafeInternalPath", () => {
  it.each(["/", "/acme", "/acme/boards/1?tab=a#x", "/a%20b"])("accepts %s", (path) => {
    expect(isSafeInternalPath(path)).toBe(true);
  });

  it.each([
    ["absolute URL", "https://evil.example/x"],
    ["protocol-relative", "//evil.example"],
    ["backslash host trick", "/\\evil.example"],
    ["javascript scheme", "javascript:alert(1)"],
    ["relative without slash", "acme"],
    ["empty", ""],
    ["newline injection", "/ok\r\nSet-Cookie: x=1"],
    ["tab character", "/a\tb"],
    ["null", null],
    ["number", 42],
    ["undefined", undefined],
  ])("rejects %s", (_label, value) => {
    expect(isSafeInternalPath(value)).toBe(false);
  });

  it("rejects a path that URL parsing cannot resolve to the same origin", () => {
    expect(isSafeInternalPath("/@evil.example")).toBe(true); // still a path on our origin
    expect(isSafeInternalPath("/\u0000")).toBe(false);
  });
});

describe("sanitizeNextPath", () => {
  it("passes safe paths through", () => {
    expect(sanitizeNextPath("/acme", "/")).toBe("/acme");
  });

  it("falls back for unsafe or missing values", () => {
    expect(sanitizeNextPath("https://evil.example", "/home")).toBe("/home");
    expect(sanitizeNextPath(undefined, "/home")).toBe("/home");
  });
});
