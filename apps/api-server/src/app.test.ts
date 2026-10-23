/**
 * @file app.test.ts
 * @description Integration tests for the app factory: health endpoints, the standard error
 * shape, request-id propagation and the CORS origin restriction. Uses `app.inject()` so no
 * port is opened and no real dependencies are required.
 */
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorResponseSchema } from "shared-types";
import { buildApp } from "@/app";
import { AppError } from "@/errors/app-error";
import { ReadinessService, type ReadinessCheck } from "@/services/readiness.service";

const config = { WEB_ORIGIN: "http://localhost:3000", LOG_LEVEL: "silent" } as const;

const upCheck: ReadinessCheck = { name: "postgres", check: async () => undefined };
const downCheck: ReadinessCheck = {
  name: "postgres",
  check: async () => {
    throw new Error("connection refused: secret-host");
  },
};

let app: FastifyInstance;

async function build(checks: ReadinessCheck[] = [upCheck]): Promise<FastifyInstance> {
  app = await buildApp(config, { readiness: new ReadinessService(checks) });
  return app;
}

afterEach(async () => {
  await app.close();
});

describe("health endpoints", () => {
  it("reports liveness without consulting dependencies", async () => {
    const instance = await build([downCheck]);
    const res = await instance.inject({ method: "GET", url: "/health/live" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("reports ready when every dependency is up", async () => {
    const instance = await build();
    const res = await instance.inject({ method: "GET", url: "/health/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ready: true, checks: { postgres: "up" } });
  });

  it("returns 503 without leaking error details when a dependency is down", async () => {
    const instance = await build([downCheck]);
    const res = await instance.inject({ method: "GET", url: "/health/ready" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ ready: false, checks: { postgres: "down" } });
    expect(res.body).not.toContain("secret-host");
  });
});

describe("error handling", () => {
  it("returns the standard shape for unknown routes", async () => {
    const instance = await build();
    const res = await instance.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(ErrorResponseSchema.parse(res.json()).code).toBe("NOT_FOUND");
  });

  it("maps AppError to its status and code", async () => {
    const instance = await build();
    instance.get("/forbidden", async () => {
      throw new AppError(403, "FORBIDDEN", "Insufficient role.");
    });
    const res = await instance.inject({ method: "GET", url: "/forbidden" });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ message: "Insufficient role.", code: "FORBIDDEN" });
  });

  it("hides internals of unexpected errors", async () => {
    const instance = await build();
    instance.get("/boom", async () => {
      throw new Error("db password is hunter2");
    });
    const res = await instance.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(ErrorResponseSchema.parse(res.json()).code).toBe("INTERNAL_ERROR");
    expect(res.body).not.toContain("hunter2");
  });

  it("maps malformed JSON bodies to a 400 BAD_REQUEST", async () => {
    const instance = await build();
    instance.post("/echo", async (request) => request.body);
    const res = await instance.inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BAD_REQUEST");
  });
});

describe("request ids and CORS", () => {
  it("generates a request id and echoes a caller-supplied one", async () => {
    const instance = await build();
    const generated = await instance.inject({ method: "GET", url: "/health/live" });
    expect(generated.headers["x-request-id"]).toBeTruthy();

    const supplied = await instance.inject({
      method: "GET",
      url: "/health/live",
      headers: { "x-request-id": "trace-123" },
    });
    expect(supplied.headers["x-request-id"]).toBe("trace-123");
  });

  it("allows only the configured web origin", async () => {
    const instance = await build();
    const allowed = await instance.inject({
      method: "GET",
      url: "/health/live",
      headers: { origin: "http://localhost:3000" },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");

    const denied = await instance.inject({
      method: "GET",
      url: "/health/live",
      headers: { origin: "http://evil.example" },
    });
    // A fixed origin is always echoed as configured, so browsers on other origins are
    // blocked by the mismatch. It must never reflect the caller's origin or use a wildcard.
    expect(denied.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});
