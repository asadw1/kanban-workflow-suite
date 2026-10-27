/**
 * @file pagination.test.ts
 * @description Unit tests for the pagination query bounds and page schema.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PaginationQuerySchema, pageSchema } from "./index";

describe("PaginationQuerySchema", () => {
  it("applies the default limit and coerces query strings", () => {
    expect(PaginationQuerySchema.parse({}).limit).toBe(DEFAULT_PAGE_SIZE);
    expect(PaginationQuerySchema.parse({ limit: "10", cursor: "abc" })).toEqual({
      limit: 10,
      cursor: "abc",
    });
  });

  it("rejects limits outside 1..MAX_PAGE_SIZE", () => {
    expect(PaginationQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(PaginationQuerySchema.safeParse({ limit: MAX_PAGE_SIZE + 1 }).success).toBe(false);
    expect(PaginationQuerySchema.safeParse({ limit: MAX_PAGE_SIZE }).success).toBe(true);
  });

  it("rejects an empty or oversized cursor", () => {
    expect(PaginationQuerySchema.safeParse({ cursor: "" }).success).toBe(false);
    expect(PaginationQuerySchema.safeParse({ cursor: "x".repeat(65) }).success).toBe(false);
  });
});

describe("pageSchema", () => {
  it("validates items and a nullable cursor", () => {
    const schema = pageSchema(z.string());
    expect(schema.parse({ items: ["a"], nextCursor: null })).toEqual({
      items: ["a"],
      nextCursor: null,
    });
    expect(schema.safeParse({ items: [1], nextCursor: null }).success).toBe(false);
  });
});
