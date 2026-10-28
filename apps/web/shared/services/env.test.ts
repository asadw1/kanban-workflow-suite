/**
 * @file env.test.ts
 * @description Unit tests for public environment validation in the web app.
 */
import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "@/shared/services/env";

describe("parsePublicEnv", () => {
  it("accepts valid URLs", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_API_URL: "http://localhost:3000/api",
      NEXT_PUBLIC_SOCKET_URL: "http://localhost:4000",
    });
    expect(env.NEXT_PUBLIC_SOCKET_URL).toBe("http://localhost:4000");
  });

  it("rejects missing variables", () => {
    expect(() => parsePublicEnv({})).toThrow(/NEXT_PUBLIC_API_URL/);
  });
});
