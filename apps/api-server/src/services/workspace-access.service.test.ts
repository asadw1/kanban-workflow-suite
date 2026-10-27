/**
 * @file workspace-access.service.test.ts
 * @description Unit tests for the RBAC guard: membership lookup, 404 for outsiders (tenant
 * isolation) and 403 for insufficient roles.
 */
import { describe, expect, it, vi } from "vitest";
import type { Role } from "shared-types";
import { WorkspaceAccessService, type AccessPrisma } from "@/services/workspace-access.service";

function guardWith(role: Role | null) {
  const findUnique = vi.fn(async () => (role ? { role } : null));
  const guard = new WorkspaceAccessService({
    workspaceMember: { findUnique },
  } as unknown as AccessPrisma);
  return { guard, findUnique };
}

describe("WorkspaceAccessService.requireRole", () => {
  it("returns the role when it meets the minimum", async () => {
    const { guard, findUnique } = guardWith("ADMIN");
    await expect(guard.requireRole("u1", "w1", "MEMBER")).resolves.toBe("ADMIN");
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_workspaceId: { userId: "u1", workspaceId: "w1" } },
      select: { role: true },
    });
  });

  it("allows an exact role match", async () => {
    const { guard } = guardWith("MEMBER");
    await expect(guard.requireRole("u1", "w1", "MEMBER")).resolves.toBe("MEMBER");
  });

  it("hides the workspace from non-members with 404", async () => {
    const { guard } = guardWith(null);
    await expect(guard.requireRole("outsider", "w1", "VIEWER")).rejects.toMatchObject({
      statusCode: 404,
      code: "WORKSPACE_NOT_FOUND",
    });
  });

  it("denies a lower role with 403 and names the requirement", async () => {
    const { guard } = guardWith("VIEWER");
    await expect(guard.requireRole("u1", "w1", "ADMIN")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
      details: { required: "ADMIN" },
    });
  });
});
