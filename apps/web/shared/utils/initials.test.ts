/**
 * @file initials.test.ts
 * @description Tests for the avatar initials formatter.
 */
import { describe, expect, it } from "vitest";
import { getInitials } from "@/shared/utils/initials";

describe("getInitials", () => {
  it("uses the first letter of the first and last words", () => {
    expect(getInitials("ada lovelace")).toBe("AL");
    expect(getInitials("Ada King Lovelace")).toBe("AL");
  });

  it("returns a single letter for one word", () => {
    expect(getInitials("Plato")).toBe("P");
  });

  it("ignores surrounding and repeated whitespace", () => {
    expect(getInitials("  grace   hopper ")).toBe("GH");
  });

  it("falls back to a question mark for blank input", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
  });

  it("keeps astral characters intact", () => {
    expect(getInitials("𝒜da")).toBe("𝒜");
  });
});
