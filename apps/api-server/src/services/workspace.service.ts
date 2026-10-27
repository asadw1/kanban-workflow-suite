/**
 * @file workspace.service.ts
 * @description Workspace and membership use cases: create, list, resolve, list members,
 * invite and change roles. Every operation resolves the caller role through the injected
 * {@link WorkspaceRoleGuard} first, and every mutation writes its `ActivityLog` row in the same
 * `$transaction` so the audit trail can never disagree with the data (TAD section 9.6).
 */
import { Prisma, type PrismaClient } from "database";
import type {
  AssignableRole,
  ChangeMemberRoleRequest,
  CreateWorkspaceRequest,
  InviteMemberRequest,
  Page,
  PaginationQuery,
  Role,
  WorkspaceDto,
  WorkspaceMemberDto,
} from "shared-types";
import { AppError } from "@/errors/app-error";
import type { WorkspaceRoleGuard } from "@/services/workspace-access.service";

/** Subset of Prisma the service needs. */
export type WorkspacePrisma = Pick<
  PrismaClient,
  "workspace" | "workspaceMember" | "user" | "$transaction"
>;

/** Collaborators for {@link WorkspaceService}. */
export interface WorkspaceServiceDeps {
  prisma: WorkspacePrisma;
  guard: WorkspaceRoleGuard;
}

/** Roles an ADMIN (as opposed to the OWNER) may grant or modify. */
const ADMIN_MANAGEABLE: readonly Role[] = ["MEMBER", "VIEWER"];

/** True for Prisma unique-constraint violations. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Slices a `limit + 1` fetch into a page. Fetching one extra row tells us whether another page
 * exists without a separate COUNT query.
 */
function toPage<T extends { id: string }, R>(
  rows: T[],
  limit: number,
  map: (row: T) => R,
): Page<R> {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items: items.map(map), nextCursor: hasMore && last ? last.id : null };
}

/** Workspace and membership use cases. */
export class WorkspaceService {
  /** @param deps - Injected client and RBAC guard. */
  constructor(private readonly deps: WorkspaceServiceDeps) {}

  /**
   * Creates a workspace owned by the caller.
   *
   * @param userId - Authenticated caller; becomes `OWNER`.
   * @param input - Validated name and slug.
   * @returns The new workspace with the caller role.
   * @throws AppError 409 `SLUG_TAKEN` when the slug is already used.
   * @sideEffects Inserts workspace, owner membership and an audit row atomically.
   */
  async create(userId: string, input: CreateWorkspaceRequest): Promise<WorkspaceDto> {
    try {
      return await this.deps.prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
          data: {
            name: input.name,
            slug: input.slug,
            members: { create: { userId, role: "OWNER" } },
          },
        });
        // Separate statement (not a nested create) because the audit row needs the new id.
        await tx.activityLog.create({
          data: {
            action: "workspace:create",
            entityType: "workspace",
            entityId: workspace.id,
            actorId: userId,
            workspaceId: workspace.id,
          },
        });
        return { id: workspace.id, name: workspace.name, slug: workspace.slug, role: "OWNER" };
      });
    } catch (error) {
      // The unique index is the arbiter, so two simultaneous requests cannot both win.
      if (isUniqueViolation(error)) {
        throw new AppError(409, "SLUG_TAKEN", "A workspace with this slug already exists.");
      }
      throw error;
    }
  }

  /**
   * Lists the workspaces the caller belongs to.
   *
   * @param userId - Authenticated caller. Scoping by this id is what stops tenants seeing
   * each other.
   * @param page - Validated pagination query.
   * @returns One page of workspaces with the caller role in each.
   */
  async listForUser(userId: string, page: PaginationQuery): Promise<Page<WorkspaceDto>> {
    const rows = await this.deps.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { id: "asc" },
      take: page.limit + 1,
      ...(page.cursor && { cursor: { id: page.cursor }, skip: 1 }),
    });
    return toPage(rows, page.limit, (row) => ({
      id: row.workspace.id,
      name: row.workspace.name,
      slug: row.workspace.slug,
      role: row.role,
    }));
  }

  /**
   * Resolves one workspace for the caller (the "switch workspace" lookup).
   *
   * @param userId - Authenticated caller.
   * @param workspaceId - Workspace to resolve.
   * @returns The workspace with the caller role.
   * @throws AppError 404 `WORKSPACE_NOT_FOUND` for non-members.
   */
  async get(userId: string, workspaceId: string): Promise<WorkspaceDto> {
    const role = await this.deps.guard.requireRole(userId, workspaceId, "VIEWER");
    const workspace = await this.deps.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found.");
    return { id: workspace.id, name: workspace.name, slug: workspace.slug, role };
  }

  /**
   * Lists members of a workspace.
   *
   * @param userId - Authenticated caller (any role may view the roster).
   * @param workspaceId - Target workspace.
   * @param page - Validated pagination query.
   * @returns One page of members.
   * @throws AppError 404 for non-members.
   */
  async listMembers(
    userId: string,
    workspaceId: string,
    page: PaginationQuery,
  ): Promise<Page<WorkspaceMemberDto>> {
    await this.deps.guard.requireRole(userId, workspaceId, "VIEWER");
    const rows = await this.deps.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { id: "asc" },
      take: page.limit + 1,
      ...(page.cursor && { cursor: { id: page.cursor }, skip: 1 }),
    });
    return toPage(rows, page.limit, (row) => ({
      id: row.id,
      userId: row.userId,
      name: row.user.name,
      email: row.user.email,
      avatarUrl: row.user.avatarUrl,
      role: row.role,
    }));
  }

  /**
   * Adds an existing user to the workspace by email.
   *
   * Invitations are immediate for now: there is no pending-invite state or email yet (email
   * delivery arrives with the BullMQ notification worker). Only registered users can be added.
   *
   * @param actorId - Authenticated caller; must be ADMIN or above.
   * @param workspaceId - Target workspace.
   * @param input - Validated email and role.
   * @returns The new member.
   * @throws AppError 403 when an ADMIN tries to grant ADMIN; 404 `USER_NOT_FOUND`; 409
   * `ALREADY_MEMBER`.
   * @sideEffects Inserts the membership and an audit row atomically.
   */
  async inviteMember(
    actorId: string,
    workspaceId: string,
    input: InviteMemberRequest,
  ): Promise<WorkspaceMemberDto> {
    const actorRole = await this.deps.guard.requireRole(actorId, workspaceId, "ADMIN");
    this.assertMayAssign(actorRole, input.role);

    const user = await this.deps.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "No registered user has this email address.");
    }

    try {
      return await this.deps.prisma.$transaction(async (tx) => {
        const member = await tx.workspaceMember.create({
          data: { workspaceId, userId: user.id, role: input.role },
        });
        await tx.activityLog.create({
          data: {
            action: "member:invite",
            entityType: "workspaceMember",
            entityId: member.id,
            details: { userId: user.id, role: input.role },
            actorId,
            workspaceId,
          },
        });
        return this.toMemberDto(member.id, user, member.role);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(409, "ALREADY_MEMBER", "This user is already a member.");
      }
      throw error;
    }
  }

  /**
   * Changes a member role.
   *
   * Privilege rules: OWNER can change anyone but another OWNER; ADMIN can only move MEMBER and
   * VIEWER targets between MEMBER and VIEWER. The target is looked up with the `workspaceId`
   * filter, so a member id from another tenant is indistinguishable from a missing one.
   *
   * @param actorId - Authenticated caller; must be ADMIN or above.
   * @param workspaceId - Target workspace.
   * @param memberId - `WorkspaceMember.id` to modify.
   * @param input - Validated new role.
   * @returns The updated member.
   * @throws AppError 403 for rule violations; 404 `MEMBER_NOT_FOUND`.
   * @sideEffects Updates the role and writes an audit row atomically.
   */
  async changeMemberRole(
    actorId: string,
    workspaceId: string,
    memberId: string,
    input: ChangeMemberRoleRequest,
  ): Promise<WorkspaceMemberDto> {
    const actorRole = await this.deps.guard.requireRole(actorId, workspaceId, "ADMIN");
    return this.deps.prisma.$transaction(async (tx) => {
      const target = await tx.workspaceMember.findFirst({
        where: { id: memberId, workspaceId },
        include: { user: true },
      });
      if (!target) throw new AppError(404, "MEMBER_NOT_FOUND", "Member not found.");

      if (target.role === "OWNER") {
        throw new AppError(403, "FORBIDDEN", "The owner role cannot be changed.");
      }
      if (actorRole === "ADMIN" && !ADMIN_MANAGEABLE.includes(target.role)) {
        throw new AppError(403, "FORBIDDEN", "Only the owner can change an admin.");
      }
      this.assertMayAssign(actorRole, input.role);

      const updated = await tx.workspaceMember.update({
        where: { id: target.id },
        data: { role: input.role },
      });
      await tx.activityLog.create({
        data: {
          action: "member:role_change",
          entityType: "workspaceMember",
          entityId: target.id,
          details: { from: target.role, to: input.role },
          actorId,
          workspaceId,
        },
      });
      return this.toMemberDto(target.id, target.user, updated.role);
    });
  }

  /** Enforces that an ADMIN cannot grant ADMIN; only the OWNER can. */
  private assertMayAssign(actorRole: Role, assigned: AssignableRole): void {
    if (actorRole === "ADMIN" && !ADMIN_MANAGEABLE.includes(assigned)) {
      throw new AppError(403, "FORBIDDEN", "Only the owner can grant the admin role.");
    }
  }

  private toMemberDto(
    id: string,
    user: { id: string; name: string; email: string; avatarUrl: string | null },
    role: Role,
  ): WorkspaceMemberDto {
    return {
      id,
      userId: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role,
    };
  }
}
