/**
 * @file workspace.ts
 * @description Workspace and membership contracts shared by `apps/web` and `apps/api-server`:
 * roles, workspace and member DTOs, and the request bodies for creating workspaces, inviting
 * members and changing roles. The `Role` values mirror the Prisma `Role` enum.
 */
import { z } from "zod";
import { EmailSchema } from "./auth";

/**
 * Workspace roles, ordered from most to least privileged.
 * Must stay in sync with the Prisma `Role` enum; RBAC checks compare against this order.
 */
export const RoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

/** Workspace role, inferred from {@link RoleSchema}. */
export type Role = z.infer<typeof RoleSchema>;

/**
 * Roles that may be assigned through invites and role changes.
 * `OWNER` is excluded so ownership can only change through a dedicated transfer flow, which
 * prevents a workspace ending up with zero or silently duplicated owners.
 */
export const AssignableRoleSchema = RoleSchema.exclude(["OWNER"]);

/** Assignable role, inferred from {@link AssignableRoleSchema}. */
export type AssignableRole = z.infer<typeof AssignableRoleSchema>;

/**
 * URL-safe workspace slug: lowercase alphanumerics separated by single hyphens.
 * Globally unique (`Workspace.slug`), so uniqueness is enforced by the database, not here.
 */
export const WorkspaceSlugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

/** Request body for `POST /workspaces`. The caller becomes the `OWNER`. */
export const CreateWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: WorkspaceSlugSchema,
});

/** Create-workspace request body, inferred from {@link CreateWorkspaceRequestSchema}. */
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequestSchema>;

/** Workspace as exposed to clients, including the requesting user's role in it. */
export const WorkspaceDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: RoleSchema,
});

/** Workspace shape, inferred from {@link WorkspaceDtoSchema}. */
export type WorkspaceDto = z.infer<typeof WorkspaceDtoSchema>;

/** Workspace member as exposed to clients. */
export const WorkspaceMemberDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().url().nullable(),
  role: RoleSchema,
});

/** Workspace member shape, inferred from {@link WorkspaceMemberDtoSchema}. */
export type WorkspaceMemberDto = z.infer<typeof WorkspaceMemberDtoSchema>;

/** Request body for `POST /workspaces/:workspaceId/members` (invite by email). */
export const InviteMemberRequestSchema = z.object({
  email: EmailSchema,
  role: AssignableRoleSchema.default("MEMBER"),
});

/** Invite request body, inferred from {@link InviteMemberRequestSchema}. */
export type InviteMemberRequest = z.infer<typeof InviteMemberRequestSchema>;

/** Request body for `PATCH /workspaces/:workspaceId/members/:memberId`. */
export const ChangeMemberRoleRequestSchema = z.object({
  role: AssignableRoleSchema,
});

/** Change-role request body, inferred from {@link ChangeMemberRoleRequestSchema}. */
export type ChangeMemberRoleRequest = z.infer<typeof ChangeMemberRoleRequestSchema>;
