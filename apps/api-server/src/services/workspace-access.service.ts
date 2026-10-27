/**
 * @file workspace-access.service.ts
 * @description The single RBAC decision point. Every workspace-scoped read or write resolves
 * the caller `WorkspaceMember` row here before doing anything else, which is the primary
 * defence against cross-tenant access (TAD risk: a missed `workspaceId` filter). The result is
 * always derived from the database on each call, never from the token, so a role change or
 * removal takes effect immediately even though access tokens live for 15 minutes.
 */
import type { PrismaClient } from "database";
import type { Role } from "shared-types";
import { AppError } from "@/errors/app-error";
import { hasAtLeastRole } from "@/security/rbac";

/** Subset of Prisma the guard needs. */
export type AccessPrisma = Pick<PrismaClient, "workspaceMember">;

/** Abstraction services depend on so the guard can be swapped or faked (Dependency Inversion). */
export interface WorkspaceRoleGuard {
  /**
   * @param userId - Authenticated caller.
   * @param workspaceId - Workspace being accessed.
   * @param minimum - Least privileged role allowed.
   * @returns The caller actual role, for services that need finer-grained rules.
   * @throws AppError 404 `WORKSPACE_NOT_FOUND` when the caller is not a member, and 403
   * `FORBIDDEN` when their role is below `minimum`.
   */
  requireRole(userId: string, workspaceId: string, minimum: Role): Promise<Role>;
}

/** Prisma-backed {@link WorkspaceRoleGuard}. */
export class WorkspaceAccessService implements WorkspaceRoleGuard {
  /** @param prisma - Injected client (only `workspaceMember` is used). */
  constructor(private readonly prisma: AccessPrisma) {}

  /** @inheritdoc */
  async requireRole(userId: string, workspaceId: string, minimum: Role): Promise<Role> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });
    // Non-members get 404, not 403: confirming that a workspace id exists would let an
    // outsider enumerate other tenants.
    if (!membership) {
      throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found.");
    }
    if (!hasAtLeastRole(membership.role, minimum)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to perform this action.", {
        required: minimum,
      });
    }
    return membership.role;
  }
}
