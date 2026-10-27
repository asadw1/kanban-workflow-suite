/**
 * @file stage1.integration.test.ts
 * @description Stage 1 exit-criteria tests against a real PostgreSQL: register -> create
 * workspace -> invite, the role x endpoint denial matrix, cross-tenant rejection and refresh
 * token reuse detection. Uses unique per-run identifiers and cleans up after itself, so it is
 * safe to run against the dev database.
 */
import { randomBytes } from "node:crypto";
import { createPrismaClient } from "database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "@/app";
import { JoseAccessTokenService } from "@/security/access-token";
import { ScryptPasswordHasher } from "@/security/password-hasher";
import { AuthService } from "@/services/auth.service";
import { ReadinessService } from "@/services/readiness.service";
import { WorkspaceAccessService } from "@/services/workspace-access.service";
import { WorkspaceService } from "@/services/workspace.service";

const databaseUrl = process.env.DATABASE_URL;
const run = randomBytes(4).toString("hex");
const prisma = createPrismaClient(databaseUrl);

let app: FastifyInstance;

interface Account {
  id: string;
  email: string;
  token: string;
  cookie: string;
}

/** Registers a user through the real HTTP route and returns its credentials. */
async function register(label: string): Promise<Account> {
  const email = `${label}-${run}@it.example.com`;
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, name: label, password: "integration-pass" },
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  const cookie = res.cookies.find((c) => c.name === "refresh_token")?.value ?? "";
  return { id: body.user.id, email, token: body.accessToken, cookie };
}

const bearer = (account: Account) => ({ authorization: `Bearer ${account.token}` });

describe.skipIf(!databaseUrl)("Stage 1 exit criteria (real PostgreSQL)", () => {
  let owner: Account;
  let admin: Account;
  let member: Account;
  let viewer: Account;
  let outsider: Account;
  let workspaceId: string;
  let otherWorkspaceId: string;
  let memberRowId: string;

  beforeAll(async () => {
    const accessTokens = new JoseAccessTokenService("i".repeat(32), 900);
    app = await buildApp(
      { WEB_ORIGIN: "http://localhost:3000", LOG_LEVEL: "silent", NODE_ENV: "test" },
      {
        readiness: new ReadinessService([]),
        accessTokens,
        auth: new AuthService({
          prisma,
          hasher: new ScryptPasswordHasher({ N: 1024, r: 8, p: 1 }),
          tokens: accessTokens,
          refreshTtlMs: 86_400_000,
        }),
        workspaces: new WorkspaceService({ prisma, guard: new WorkspaceAccessService(prisma) }),
      },
    );

    [owner, admin, member, viewer, outsider] = await Promise.all([
      register("owner"),
      register("admin"),
      register("member"),
      register("viewer"),
      register("outsider"),
    ]);

    const created = await app.inject({
      method: "POST",
      url: "/workspaces",
      headers: bearer(owner),
      payload: { name: "IT Workspace", slug: `it-${run}` },
    });
    workspaceId = created.json().id;

    const other = await app.inject({
      method: "POST",
      url: "/workspaces",
      headers: bearer(outsider),
      payload: { name: "Other Tenant", slug: `other-${run}` },
    });
    otherWorkspaceId = other.json().id;
  });

  afterAll(async () => {
    // Workspaces cascade to members and audit rows; users cascade to refresh tokens.
    await prisma.workspace.deleteMany({ where: { slug: { endsWith: `-${run}` } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@it.example.com` } } });
    await app?.close();
    await prisma.$disconnect();
  });

  it("registers, creates a workspace and records the OWNER membership and audit row", async () => {
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: owner.id, workspaceId } },
    });
    expect(membership?.role).toBe("OWNER");
    const log = await prisma.activityLog.findFirst({
      where: { workspaceId, action: "workspace:create" },
    });
    expect(log?.actorId).toBe(owner.id);
  });

  it("rejects a duplicate slug with 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workspaces",
      headers: bearer(outsider),
      payload: { name: "Dup", slug: `it-${run}` },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("SLUG_TAKEN");
  });

  it("invites registered users with chosen roles and audits each", async () => {
    for (const [account, role] of [
      [admin, "MEMBER"],
      [member, "MEMBER"],
      [viewer, "VIEWER"],
    ] as const) {
      const res = await app.inject({
        method: "POST",
        url: `/workspaces/${workspaceId}/members`,
        headers: bearer(owner),
        payload: { email: account.email, role },
      });
      expect(res.statusCode).toBe(201);
      if (account === member) memberRowId = res.json().id;
      if (account === admin) {
        // Promote to ADMIN, which only the owner may do.
        const promoted = await app.inject({
          method: "PATCH",
          url: `/workspaces/${workspaceId}/members/${res.json().id}`,
          headers: bearer(owner),
          payload: { role: "ADMIN" },
        });
        expect(promoted.statusCode).toBe(200);
      }
    }
    const logs = await prisma.activityLog.count({
      where: { workspaceId, action: { in: ["member:invite", "member:role_change"] } },
    });
    expect(logs).toBe(4);
  });

  it("rejects inviting someone already in the workspace and unknown emails", async () => {
    const dup = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/members`,
      headers: bearer(owner),
      payload: { email: viewer.email },
    });
    expect(dup.statusCode).toBe(409);
    const unknown = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/members`,
      headers: bearer(owner),
      payload: { email: `nobody-${run}@it.example.com` },
    });
    expect(unknown.statusCode).toBe(404);
  });

  describe("role x endpoint matrix", () => {
    const invitePayload = () => ({ email: `nobody-${run}@it.example.com` });

    it.each([
      ["member", 403],
      ["viewer", 403],
    ] as const)("%s cannot invite (%i)", async (who, status) => {
      const account = who === "member" ? member : viewer;
      const res = await app.inject({
        method: "POST",
        url: `/workspaces/${workspaceId}/members`,
        headers: bearer(account),
        payload: invitePayload(),
      });
      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe("FORBIDDEN");
    });

    it.each([
      ["member", () => member],
      ["viewer", () => viewer],
    ] as const)("%s cannot change roles", async (_label, who) => {
      const res = await app.inject({
        method: "PATCH",
        url: `/workspaces/${workspaceId}/members/${memberRowId}`,
        headers: bearer(who()),
        payload: { role: "VIEWER" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("every member role can read the workspace and its roster", async () => {
      for (const account of [owner, admin, member, viewer]) {
        const ws = await app.inject({
          method: "GET",
          url: `/workspaces/${workspaceId}`,
          headers: bearer(account),
        });
        const roster = await app.inject({
          method: "GET",
          url: `/workspaces/${workspaceId}/members`,
          headers: bearer(account),
        });
        expect(ws.statusCode).toBe(200);
        expect(roster.json().items).toHaveLength(4);
      }
    });

    it("an admin cannot grant ADMIN or touch the owner", async () => {
      const grant = await app.inject({
        method: "POST",
        url: `/workspaces/${workspaceId}/members`,
        headers: bearer(admin),
        payload: { ...invitePayload(), role: "ADMIN" },
      });
      expect(grant.statusCode).toBe(403);

      const ownerRow = await prisma.workspaceMember.findUniqueOrThrow({
        where: { userId_workspaceId: { userId: owner.id, workspaceId } },
      });
      const touch = await app.inject({
        method: "PATCH",
        url: `/workspaces/${workspaceId}/members/${ownerRow.id}`,
        headers: bearer(admin),
        payload: { role: "VIEWER" },
      });
      expect(touch.statusCode).toBe(403);
    });
  });

  describe("cross-tenant isolation", () => {
    it("non-members get 404 on every workspace route of another tenant", async () => {
      const probes = [
        { method: "GET", url: `/workspaces/${workspaceId}` },
        { method: "GET", url: `/workspaces/${workspaceId}/members` },
        {
          method: "POST",
          url: `/workspaces/${workspaceId}/members`,
          payload: { email: owner.email },
        },
        {
          method: "PATCH",
          url: `/workspaces/${workspaceId}/members/${memberRowId}`,
          payload: { role: "VIEWER" },
        },
      ] as const;
      for (const probe of probes) {
        const res = await app.inject({ ...probe, headers: bearer(outsider) });
        expect(res.statusCode, `${probe.method} ${probe.url}`).toBe(404);
        expect(res.json().code).toBe("WORKSPACE_NOT_FOUND");
      }
    });

    it("an admin of one tenant cannot use a member id from another tenant", async () => {
      // admin is ADMIN in workspaceId, but memberRowId belongs there, so use the outsider
      // tenant instead: the foreign member id must look nonexistent.
      const foreign = await prisma.workspaceMember.findFirstOrThrow({
        where: { workspaceId: otherWorkspaceId },
      });
      const res = await app.inject({
        method: "PATCH",
        url: `/workspaces/${workspaceId}/members/${foreign.id}`,
        headers: bearer(owner),
        payload: { role: "VIEWER" },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe("MEMBER_NOT_FOUND");
    });

    it("lists only the caller own workspaces", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/workspaces",
        headers: bearer(outsider),
      });
      const ids = res.json().items.map((w: { id: string }) => w.id);
      expect(ids).toEqual([otherWorkspaceId]);
    });
  });

  describe("sessions", () => {
    it("logs in, refreshes and detects reuse of a rotated refresh token", async () => {
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: viewer.email, password: "integration-pass" },
      });
      expect(login.statusCode).toBe(200);
      const first = login.cookies.find((c) => c.name === "refresh_token")?.value ?? "";

      const rotated = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        cookies: { refresh_token: first },
      });
      expect(rotated.statusCode).toBe(200);
      const second = rotated.cookies.find((c) => c.name === "refresh_token")?.value ?? "";
      expect(second).not.toBe(first);

      const replay = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        cookies: { refresh_token: first },
      });
      expect(replay.statusCode).toBe(401);

      // The whole family is dead, including the legitimately rotated token.
      const afterTheft = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        cookies: { refresh_token: second },
      });
      expect(afterTheft.statusCode).toBe(401);
    });

    it("rejects a wrong password and a forged bearer token", async () => {
      const bad = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: viewer.email, password: "wrong-password" },
      });
      expect(bad.statusCode).toBe(401);
      const forged = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: "Bearer not.a.token" },
      });
      expect(forged.statusCode).toBe(401);
    });

    it("returns the profile for a valid token", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/me", headers: bearer(owner) });
      expect(res.json()).toMatchObject({ id: owner.id, email: owner.email });
      expect(res.body).not.toContain("passwordHash");
    });
  });
});
