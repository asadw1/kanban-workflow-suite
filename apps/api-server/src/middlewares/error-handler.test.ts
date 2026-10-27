/**
 * @file error-handler.test.ts
 * @description Unit tests for the central error mapping: every failure class must leave the
 * server as the standard `ErrorResponse` body, and internals must never leak on a 500.
 */
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ErrorResponseSchema } from "shared-types";
import { AppError } from "@/errors/app-error";
import { registerErrorHandling } from "@/middlewares/error-handler";

let app: FastifyInstance;

/** Builds an app with one route that throws whatever the test supplies. */
async function appThrowing(error: unknown): Promise<FastifyInstance> {
  app = Fastify({ logger: false });
  registerErrorHandling(app);
  app.get("/boom", async () => {
    throw error;
  });
  app.post("/json", async () => ({ ok: true }));
  return app;
}

afterEach(async () => {
  await app.close();
});

describe("registerErrorHandling", () => {
  it("keeps the status, code and details of an AppError", async () => {
    const instance = await appThrowing(new AppError(403, "FORBIDDEN", "No.", { need: "ADMIN" }));
    const res = await instance.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(403);
    expect(ErrorResponseSchema.parse(res.json())).toEqual({
      message: "No.",
      code: "FORBIDDEN",
      details: { need: "ADMIN" },
    });
  });

  it("omits details when an AppError has none", async () => {
    const instance = await appThrowing(new AppError(404, "NOT_FOUND", "Gone."));
    const res = await instance.inject({ method: "GET", url: "/boom" });
    expect(res.json()).toEqual({ message: "Gone.", code: "NOT_FOUND" });
  });

  it("maps a ZodError to 400 VALIDATION_ERROR with the issues", async () => {
    const zodError = z.object({ a: z.string() }).safeParse({}).error;
    const instance = await appThrowing(zodError);
    const res = await instance.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(res.json().details)).toBe(true);
  });

  it("maps framework 4xx errors (malformed JSON) to BAD_REQUEST", async () => {
    const instance = await appThrowing(new Error("unused"));
    const res = await instance.inject({
      method: "POST",
      url: "/json",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BAD_REQUEST");
  });

  it("hides internals of unexpected errors behind a generic 500", async () => {
    const instance = await appThrowing(new Error("db password is hunter2"));
    const res = await instance.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      message: "An unexpected error occurred.",
      code: "INTERNAL_ERROR",
    });
  });

  it("treats a non-Error thrown with a 5xx status as a generic 500", async () => {
    const instance = await appThrowing({ statusCode: 503 });
    const res = await instance.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json().code).toBe("INTERNAL_ERROR");
  });

  it("falls back to a default message for a non-Error 4xx", async () => {
    const instance = await appThrowing({ statusCode: 418 });
    const res = await instance.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(418);
    expect(res.json()).toEqual({ message: "Bad request.", code: "BAD_REQUEST" });
  });

  it("returns the standard body for unknown routes", async () => {
    const instance = await appThrowing(new Error("x"));
    const res = await instance.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });
});
