/**
 * @file env.test.ts
 * @description Unit tests for API server environment validation.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnv, parseEnv } from "@/config/env";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "change-me",
};

describe("parseEnv", () => {
  it("applies defaults for optional variables", () => {
    const env = parseEnv(valid);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
  });

  it("rejects an access token lifetime outside the allowed range", () => {
    expect(() => parseEnv({ ...valid, JWT_ACCESS_TTL_SECONDS: "5" })).toThrow(
      /JWT_ACCESS_TTL_SECONDS/,
    );
  });

  it("rejects missing required variables and names them", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects the example JWT secret in production", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production" })).toThrow(/JWT_SECRET/);
  });

  it("accepts a strong JWT secret in production", () => {
    const env = parseEnv({ ...valid, NODE_ENV: "production", JWT_SECRET: "x".repeat(32) });
    expect(env.NODE_ENV).toBe("production");
  });

  it("does not leak secret values in error messages", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production" })).not.toThrow(/change-me/);
  });
});

describe("loadEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the real process environment", () => {
    vi.stubEnv("DATABASE_URL", valid.DATABASE_URL);
    vi.stubEnv("REDIS_URL", valid.REDIS_URL);
    vi.stubEnv("JWT_SECRET", valid.JWT_SECRET);
    expect(loadEnv().DATABASE_URL).toBe(valid.DATABASE_URL);
  });
});
