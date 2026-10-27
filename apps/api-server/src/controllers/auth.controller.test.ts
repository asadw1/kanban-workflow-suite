/**
 * @file auth.controller.test.ts
 * @description HTTP-level tests for `/auth/*` using `app.inject()` with a faked service:
 * validation, cookie attributes, token never in the body, and authentication on `/auth/me`.
 */
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { AuthResponseSchema, UserDtoSchema } from "shared-types";
import { buildApp, type AppConfig } from "@/app";
import { AppError } from "@/errors/app-error";
import { ReadinessService } from "@/services/readiness.service";
import { createFakeAuth, fakeAccessTokens } from "@/testing/auth-fakes";

let app: FastifyInstance;

async function build(overrides: Partial<AppConfig> = {}) {
  const auth = createFakeAuth();
  app = await buildApp(
    { WEB_ORIGIN: "http://localhost:3000", LOG_LEVEL: "silent", NODE_ENV: "test", ...overrides },
    { readiness: new ReadinessService([]), auth, accessTokens: fakeAccessTokens },
  );
  return auth;
}

afterEach(async () => {
  await app.close();
});

const registerBody = { email: "Ada@Example.com", name: "Ada", password: "correct horse" };

describe("POST /auth/register", () => {
  it("returns 201 with a token body and an httpOnly strict refresh cookie", async () => {
    const auth = await build();
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: registerBody });
    expect(res.statusCode).toBe(201);
    expect(AuthResponseSchema.parse(res.json()).accessToken).toBe("access-token");
    // The refresh token must only ever travel in the cookie.
    expect(res.body).not.toContain("refresh-token");
    const cookie = res.cookies[0];
    expect(cookie).toMatchObject({
      name: "refresh_token",
      value: "refresh-token",
      httpOnly: true,
      sameSite: "Strict",
      path: "/auth",
    });
    expect(cookie?.secure).toBeFalsy();
    expect(res.headers["cache-control"]).toBe("no-store");
    // The schema normalised the email before it reached the service.
    expect(auth.register).toHaveBeenCalledWith({
      email: "ada@example.com",
      name: "Ada",
      password: "correct horse",
    });
  });

  it("marks the cookie Secure in production", async () => {
    await build({ NODE_ENV: "production" });
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: registerBody });
    expect(res.cookies[0]?.secure).toBe(true);
  });

  it("rejects an invalid body with 400 before calling the service", async () => {
    const auth = await build();
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { ...registerBody, password: "short" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    expect(auth.register).not.toHaveBeenCalled();
  });

  it("surfaces a taken email as 409", async () => {
    const auth = await build();
    auth.register.mockRejectedValueOnce(new AppError(409, "EMAIL_TAKEN", "taken"));
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: registerBody });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("EMAIL_TAKEN");
  });
});

describe("POST /auth/login", () => {
  it("returns 200 and sets the refresh cookie", async () => {
    await build();
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ada@example.com", password: "x" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.cookies[0]?.name).toBe("refresh_token");
  });

  it("surfaces bad credentials as 401", async () => {
    const auth = await build();
    auth.login.mockRejectedValueOnce(new AppError(401, "INVALID_CREDENTIALS", "no"));
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ada@example.com", password: "x" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects an invalid body with 400", async () => {
    await build();
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /auth/refresh", () => {
  it("rotates using the cookie", async () => {
    const auth = await build();
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { refresh_token: "old" },
    });
    expect(res.statusCode).toBe(200);
    expect(auth.refresh).toHaveBeenCalledWith("old");
  });

  it("rejects a missing cookie with 401 without calling the service", async () => {
    const auth = await build();
    const res = await app.inject({ method: "POST", url: "/auth/refresh" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("INVALID_REFRESH_TOKEN");
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it("clears the cookie when the token is refused", async () => {
    const auth = await build();
    auth.refresh.mockRejectedValueOnce(new AppError(401, "INVALID_REFRESH_TOKEN", "bad"));
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { refresh_token: "stolen" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.cookies[0]).toMatchObject({ name: "refresh_token", value: "" });
  });
});

describe("POST /auth/logout", () => {
  it("revokes the session and clears the cookie", async () => {
    const auth = await build();
    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: { refresh_token: "mine" },
    });
    expect(res.statusCode).toBe(204);
    expect(auth.logout).toHaveBeenCalledWith("mine");
    expect(res.cookies[0]).toMatchObject({ name: "refresh_token", value: "" });
  });

  it("succeeds without a cookie", async () => {
    const auth = await build();
    const res = await app.inject({ method: "POST", url: "/auth/logout" });
    expect(res.statusCode).toBe(204);
    expect(auth.logout).not.toHaveBeenCalled();
  });
});

describe("GET /auth/me", () => {
  it("returns the profile for a valid bearer token", async () => {
    const auth = await build();
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: "Bearer valid" },
    });
    expect(res.statusCode).toBe(200);
    expect(UserDtoSchema.parse(res.json()).id).toBe("user_1");
    expect(auth.getProfile).toHaveBeenCalledWith("user_1");
  });

  it("rejects a missing header with 401", async () => {
    await build();
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHENTICATED");
  });

  it("rejects a non-Bearer scheme and an invalid token", async () => {
    await build();
    const basic = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: "Basic abc" },
    });
    const bad = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: "Bearer forged" },
    });
    expect(basic.statusCode).toBe(401);
    expect(bad.statusCode).toBe(401);
  });
});
