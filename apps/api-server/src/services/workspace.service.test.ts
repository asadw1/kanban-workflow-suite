/**
 * @file workspace.service.test.ts
 * @description Unit tests for WorkspaceService with faked Prisma and RBAC guard: creation,
 * pagination, cross-tenant rejection, invite and role-change rules, and audit entries.
 */
import { Prisma } from "database";
import { describe, expect, it, vi } from "vitest";
import type { Role } from "shared-types";
import { AppError } from "@/errors/app-error";
import { WorkspaceService, type WorkspacePrisma } from "@/services/workspace.service";
import type { WorkspaceRoleGuard } from "@/services/workspace-access.service";

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" });

const page = { limit: 2 };
const bob = { id: "u_bob", name: "Bob", email: "bob@example.com", avatarUrl: null };

/** Builds a service whose guard resolves to `role` (or rejects like a non-member). */
function setup(role: Role | "outsider" = "OWNER") {
  const db = {
    workspace: { create: vi.fn(), findUnique: vi.fn() },
    workspaceMember: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    activityLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };
  const guard: WorkspaceRoleGuard = {
    requireRole: vi.fn(async () => {
      if (role === "outsider") {
        throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found.");
      }
      return role;
    }),
  };
  const service = new WorkspaceService({ prisma: db as unknown as WorkspacePrisma, guard });
  return { service, db, guard };
}

describe("create", () => {
  it("creates the workspace with an OWNER membership and an audit row in one transaction", async () => {
    const { service, db } = setup();
    db.workspace.create.mockResolvedValue({ id: "w1", name: "Acme", slug: "acme" });
    const result = await service.create("u1", { name: "Acme", slug: "acme" });
    expect(result).toEqual({ id: "w1", name: "Acme", slug: "acme", role: "OWNER" });
    expect(db.workspace.create).toHaveBeenCalledWith({
      data: { name: "Acme", slug: "acme", members: { create: { userId: "u1", role: "OWNER" } } },
    });
    expect(db.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "workspace:create",
        entityId: "w1",
        workspaceId: "w1",
      }),
    });
    expect(db.$transaction).toHaveBeenCalledOnce();
  });

  it("maps a duplicate slug to 409 SLUG_TAKEN", async () => {
    const { service, db } = setup();
    db.workspace.create.mockRejectedValue(uniqueViolation());
    await expect(service.create("u1", { name: "A", slug: "acme" })).rejects.toMatchObject({
      statusCode: 409,
      code: "SLUG_TAKEN",
    });
  });

  it("rethrows unexpected errors", async () => {
    const { service, db } = setup();
    db.workspace.create.mockRejectedValue(new Error("down"));
    await expect(service.create("u1", { name: "A", slug: "acme" })).rejects.toThrow("down");
  });
});

describe("listForUser", () => {
  const rows = [1, 2, 3].map((n) => ({
    id: `m${n}`,
    role: "MEMBER" as Role,
    workspace: { id: `w${n}`, name: `W${n}`, slug: `w-${n}` },
  }));

  it("scopes by the caller and returns a next cursor when more rows exist", async () => {
    const { service, db } = setup();
    db.workspaceMember.findMany.mockResolvedValue(rows);
    const result = await service.listForUser("u1", page);
    expect(db.workspaceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" }, take: 3 }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({ id: "w1", name: "W1", slug: "w-1", role: "MEMBER" });
    expect(result.nextCursor).toBe("m2");
  });

  it("returns a null cursor on the last page and forwards the cursor", async () => {
    const { service, db } = setup();
    db.workspaceMember.findMany.mockResolvedValue(rows.slice(0, 1));
    const result = await service.listForUser("u1", { limit: 2, cursor: "m0" });
    expect(db.workspaceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "m0" }, skip: 1 }),
    );
    expect(result.nextCursor).toBeNull();
  });

  it("handles an empty result", async () => {
    const { service, db } = setup();
    db.workspaceMember.findMany.mockResolvedValue([]);
    expect(await service.listForUser("u1", page)).toEqual({ items: [], nextCursor: null });
  });
});

describe("get", () => {
  it("returns the workspace with the caller role", async () => {
    const { service, db } = setup("MEMBER");
    db.workspace.findUnique.mockResolvedValue({ id: "w1", name: "Acme", slug: "acme" });
    expect(await service.get("u1", "w1")).toEqual({
      id: "w1",
      name: "Acme",
      slug: "acme",
      role: "MEMBER",
    });
  });

  it("rejects a non-member before touching the workspace table", async () => {
    const { service, db } = setup("outsider");
    await expect(service.get("u1", "w1")).rejects.toMatchObject({ statusCode: 404 });
    expect(db.workspace.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 if the workspace vanished after the membership check", async () => {
    const { service, db } = setup("VIEWER");
    db.workspace.findUnique.mockResolvedValue(null);
    await expect(service.get("u1", "w1")).rejects.toMatchObject({ code: "WORKSPACE_NOT_FOUND" });
  });
});

describe("listMembers", () => {
  it("requires membership, filters by workspace and maps members", async () => {
    const { service, db, guard } = setup("VIEWER");
    db.workspaceMember.findMany.mockResolvedValue([
      { id: "m1", userId: bob.id, role: "ADMIN", user: bob },
    ]);
    const result = await service.listMembers("u1", "w1", page);
    expect(guard.requireRole).toHaveBeenCalledWith("u1", "w1", "VIEWER");
    expect(db.workspaceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "w1" } }),
    );
    expect(result.items[0]).toEqual({
      id: "m1",
      userId: "u_bob",
      name: "Bob",
      email: "bob@example.com",
      avatarUrl: null,
      role: "ADMIN",
    });
  });

  it("forwards the cursor", async () => {
    const { service, db } = setup("VIEWER");
    db.workspaceMember.findMany.mockResolvedValue([]);
    await service.listMembers("u1", "w1", { limit: 5, cursor: "m9" });
    expect(db.workspaceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "m9" }, skip: 1 }),
    );
  });

  it("rejects non-members", async () => {
    const { service } = setup("outsider");
    await expect(service.listMembers("u1", "w1", page)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("inviteMember", () => {
  it("adds an existing user and records an audit row", async () => {
    const { service, db, guard } = setup("ADMIN");
    db.user.findUnique.mockResolvedValue(bob);
    db.workspaceMember.create.mockResolvedValue({ id: "m9", role: "MEMBER" });
    const result = await service.inviteMember("u1", "w1", { email: bob.email, role: "MEMBER" });
    expect(guard.requireRole).toHaveBeenCalledWith("u1", "w1", "ADMIN");
    expect(result).toMatchObject({ id: "m9", userId: "u_bob", role: "MEMBER" });
    expect(db.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "member:invite", entityId: "m9", workspaceId: "w1" }),
    });
  });

  it("lets the owner grant ADMIN but not an admin", async () => {
    const owner = setup("OWNER");
    owner.db.user.findUnique.mockResolvedValue(bob);
    owner.db.workspaceMember.create.mockResolvedValue({ id: "m9", role: "ADMIN" });
    await expect(
      owner.service.inviteMember("u1", "w1", { email: bob.email, role: "ADMIN" }),
    ).resolves.toMatchObject({ role: "ADMIN" });

    const admin = setup("ADMIN");
    await expect(
      admin.service.inviteMember("u1", "w1", { email: bob.email, role: "ADMIN" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(admin.db.workspaceMember.create).not.toHaveBeenCalled();
  });

  it("returns 404 USER_NOT_FOUND for an unregistered email", async () => {
    const { service, db } = setup("ADMIN");
    db.user.findUnique.mockResolvedValue(null);
    await expect(
      service.inviteMember("u1", "w1", { email: "x@y.co", role: "MEMBER" }),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("maps a duplicate membership to 409 ALREADY_MEMBER", async () => {
    const { service, db } = setup("ADMIN");
    db.user.findUnique.mockResolvedValue(bob);
    db.workspaceMember.create.mockRejectedValue(uniqueViolation());
    await expect(
      service.inviteMember("u1", "w1", { email: bob.email, role: "MEMBER" }),
    ).rejects.toMatchObject({ statusCode: 409, code: "ALREADY_MEMBER" });
  });

  it("rethrows unexpected errors", async () => {
    const { service, db } = setup("ADMIN");
    db.user.findUnique.mockResolvedValue(bob);
    db.workspaceMember.create.mockRejectedValue(new Error("down"));
    await expect(
      service.inviteMember("u1", "w1", { email: bob.email, role: "MEMBER" }),
    ).rejects.toThrow("down");
  });

  it("rejects callers below ADMIN and outsiders via the guard", async () => {
    const outsider = setup("outsider");
    await expect(
      outsider.service.inviteMember("u1", "w1", { email: bob.email, role: "MEMBER" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(outsider.db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("changeMemberRole", () => {
  const target = (role: Role) => ({ id: "m2", role, user: bob });

  it("lets an admin move a MEMBER to VIEWER and logs it", async () => {
    const { service, db } = setup("ADMIN");
    db.workspaceMember.findFirst.mockResolvedValue(target("MEMBER"));
    db.workspaceMember.update.mockResolvedValue({ role: "VIEWER" });
    const result = await service.changeMemberRole("u1", "w1", "m2", { role: "VIEWER" });
    expect(result.role).toBe("VIEWER");
    expect(db.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m2", workspaceId: "w1" } }),
    );
    expect(db.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "member:role_change",
        details: { from: "MEMBER", to: "VIEWER" },
      }),
    });
  });

  it("lets the owner promote to ADMIN and modify an admin", async () => {
    const { service, db } = setup("OWNER");
    db.workspaceMember.findFirst.mockResolvedValue(target("ADMIN"));
    db.workspaceMember.update.mockResolvedValue({ role: "MEMBER" });
    await expect(
      service.changeMemberRole("u1", "w1", "m2", { role: "MEMBER" }),
    ).resolves.toMatchObject({ role: "MEMBER" });
  });

  it("returns 404 for a member id from another workspace", async () => {
    const { service, db } = setup("OWNER");
    db.workspaceMember.findFirst.mockResolvedValue(null);
    await expect(
      service.changeMemberRole("u1", "w1", "foreign", { role: "VIEWER" }),
    ).rejects.toMatchObject({ statusCode: 404, code: "MEMBER_NOT_FOUND" });
    expect(db.workspaceMember.update).not.toHaveBeenCalled();
  });

  it("never lets anyone change the owner", async () => {
    const { service, db } = setup("OWNER");
    db.workspaceMember.findFirst.mockResolvedValue(target("OWNER"));
    await expect(
      service.changeMemberRole("u1", "w1", "m2", { role: "MEMBER" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("stops an admin from modifying another admin", async () => {
    const { service, db } = setup("ADMIN");
    db.workspaceMember.findFirst.mockResolvedValue(target("ADMIN"));
    await expect(
      service.changeMemberRole("u1", "w1", "m2", { role: "VIEWER" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.workspaceMember.update).not.toHaveBeenCalled();
  });

  it("stops an admin from promoting someone to ADMIN", async () => {
    const { service, db } = setup("ADMIN");
    db.workspaceMember.findFirst.mockResolvedValue(target("MEMBER"));
    await expect(
      service.changeMemberRole("u1", "w1", "m2", { role: "ADMIN" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects non-members before any lookup", async () => {
    const { service, db } = setup("outsider");
    await expect(
      service.changeMemberRole("u1", "w1", "m2", { role: "VIEWER" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.workspaceMember.findFirst).not.toHaveBeenCalled();
  });
});
