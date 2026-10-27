/**
 * @file authenticate.test.ts
 * @description Unit tests for the fail-closed identity accessor.
 */
import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { requireAuth } from "@/middlewares/authenticate";

describe("requireAuth", () => {
  it("returns the identity set by the authenticate hook", () => {
    const request = { auth: { userId: "user_1" } } as FastifyRequest;
    expect(requireAuth(request)).toEqual({ userId: "user_1" });
  });

  it("fails closed with 401 when the hook did not run", () => {
    expect(() => requireAuth({} as FastifyRequest)).toThrowError(
      expect.objectContaining({ statusCode: 401, code: "UNAUTHENTICATED" }),
    );
  });
});
