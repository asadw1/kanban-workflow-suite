/**
 * @file workspace.controller.test.ts
 * @description HTTP-level tests for workspace and member routes with a faked service: every
 * route requires authentication, inputs are validated, and the caller id from the token (never
 * from the request) is what reaches the service.
 */
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "@/app";
import { AppError } from "@/errors/app-error";
import { ReadinessService } from "@/services/readiness.service";
import { createFakeAuth, createFakeWorkspaces, fakeAccessTokens } from "@/testing/auth-fakes";

let app: FastifyInstance;

async function build() {
  const workspaces = createFakeWorkspaces();
  app = await buildApp(
    { WEB_ORIGIN: "http://localhost:3000", LOG_LEVEL: "silent", NODE_ENV: "test" },
    {
      readiness: new ReadinessService([]),
      auth: createFakeAuth(),
      workspaces,
      accessTokens: fakeAccessTokens,
    },
  );
  return workspaces;
}

const authed = { authorization: "Bearer valid" };

afterEach(async () => {
  await app.close();
});

describe("authentication", () => {
  const routes = [
    { method: "GET", url: "/workspaces" },
    { method: "POST", url: "/workspaces" },
    { method: "GET", url: "/workspaces/w1" },
    { method: "GET", url: "/workspaces/by-slug/acme" },
    { method: "GET", url: "/workspaces/w1/members" },
    { method: "POST", url: "/workspaces/w1/members" },
    { method: "PATCH", url: "/workspaces/w1/members/m1" },
  ] as const;

  for (const route of routes) {
    it(`${route.method} ${route.url} requires a bearer token`, async () => {
      const workspaces = await build();
      const res = await app.inject({ method: route.method, url: route.url, payload: {} });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe("UNAUTHENTICATED");
      for (const spy of Object.values(workspaces)) expect(spy).not.toHaveBeenCalled();
    });
  }
});

describe("POST /workspaces", () => {
  it("creates a workspace for the token user", async () => {
    const workspaces = await build();
    const res = await app.inject({
      method: "POST",
      url: "/workspaces",
      headers: authed,
      payload: { name: "Acme", slug: "acme" },
    });
    expect(res.statusCode).toBe(201);
    expect(workspaces.create).toHaveBeenCalledWith("user_1", { name: "Acme", slug: "acme" });
  });

  it("rejects an invalid slug with 400", async () => {
    const workspaces = await build();
    const res = await app.inject({
      method: "POST",
      url: "/workspaces",
      headers: authed,
      payload: { name: "Acme", slug: "Bad Slug" },
    });
    expect(res.statusCode).toBe(400);
    expect(workspaces.create).not.toHaveBeenCalled();
  });
});

describe("GET /workspaces", () => {
  it("lists with parsed pagination", async () => {
    const workspaces = await build();
    const res = await app.inject({
      method: "GET",
      url: "/workspaces?limit=10&cursor=abc",
      headers: authed,
    });
    expect(res.statusCode).toBe(200);
    expect(workspaces.listForUser).toHaveBeenCalledWith("user_1", { limit: 10, cursor: "abc" });
  });

  it("rejects an oversized page", async () => {
    await build();
    const res = await app.inject({ method: "GET", url: "/workspaces?limit=500", headers: authed });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /workspaces/:workspaceId", () => {
  it("resolves the workspace for the token user", async () => {
    const workspaces = await build();
    const res = await app.inject({ method: "GET", url: "/workspaces/w1", headers: authed });
    expect(res.statusCode).toBe(200);
    expect(workspaces.get).toHaveBeenCalledWith("user_1", "w1");
  });

  it("surfaces cross-tenant access as 404 from the service", async () => {
    const workspaces = await build();
    workspaces.get.mockRejectedValueOnce(
      new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found."),
    );
    const res = await app.inject({ method: "GET", url: "/workspaces/other", headers: authed });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("WORKSPACE_NOT_FOUND");
  });
});

describe("GET /workspaces/by-slug/:slug", () => {
  it("resolves by slug for the token user, not as a workspace id", async () => {
    const workspaces = await build();
    const res = await app.inject({
      method: "GET",
      url: "/workspaces/by-slug/acme",
      headers: authed,
    });
    expect(res.statusCode).toBe(200);
    expect(workspaces.getBySlug).toHaveBeenCalledWith("user_1", "acme");
    expect(workspaces.get).not.toHaveBeenCalled();
  });

  it("rejects a malformed slug with 400", async () => {
    const workspaces = await build();
    const res = await app.inject({
      method: "GET",
      url: "/workspaces/by-slug/Bad_Slug",
      headers: authed,
    });
    expect(res.statusCode).toBe(400);
    expect(workspaces.getBySlug).not.toHaveBeenCalled();
  });
});

describe("members", () => {
  it("lists members with pagination", async () => {
    const workspaces = await build();
    const res = await app.inject({
      method: "GET",
      url: "/workspaces/w1/members?limit=5",
      headers: authed,
    });
    expect(res.statusCode).toBe(200);
    expect(workspaces.listMembers).toHaveBeenCalledWith("user_1", "w1", { limit: 5 });
  });

  it("invites with a default MEMBER role", async () => {
    const workspaces = await build();
    const res = await app.inject({
      method: "POST",
      url: "/workspaces/w1/members",
      headers: authed,
      payload: { email: "Bob@Example.com" },
    });
    expect(res.statusCode).toBe(201);
    expect(workspaces.inviteMember).toHaveBeenCalledWith("user_1", "w1", {
      email: "bob@example.com",
      role: "MEMBER",
    });
  });

  it("refuses to invite an OWNER at the validation layer", async () => {
    const workspaces = await build();
    const res = await app.inject({
      method: "POST",
      url: "/workspaces/w1/members",
      headers: authed,
      payload: { email: "bob@example.com", role: "OWNER" },
    });
    expect(res.statusCode).toBe(400);
    expect(workspaces.inviteMember).not.toHaveBeenCalled();
  });

  it("changes a role and forwards a 403 from the service", async () => {
    const workspaces = await build();
    const ok = await app.inject({
      method: "PATCH",
      url: "/workspaces/w1/members/m1",
      headers: authed,
      payload: { role: "VIEWER" },
    });
    expect(ok.statusCode).toBe(200);
    expect(workspaces.changeMemberRole).toHaveBeenCalledWith("user_1", "w1", "m1", {
      role: "VIEWER",
    });

    workspaces.changeMemberRole.mockRejectedValueOnce(new AppError(403, "FORBIDDEN", "no"));
    const denied = await app.inject({
      method: "PATCH",
      url: "/workspaces/w1/members/m1",
      headers: authed,
      payload: { role: "VIEWER" },
    });
    expect(denied.statusCode).toBe(403);
  });

  it("rejects a role change to OWNER with 400", async () => {
    await build();
    const res = await app.inject({
      method: "PATCH",
      url: "/workspaces/w1/members/m1",
      headers: authed,
      payload: { role: "OWNER" },
    });
    expect(res.statusCode).toBe(400);
  });
});
