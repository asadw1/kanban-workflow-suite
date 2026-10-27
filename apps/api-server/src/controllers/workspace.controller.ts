/**
 * @file workspace.controller.ts
 * @description HTTP transport for workspaces and membership. Every route sits behind the
 * bearer-token pre-handler; authorization (membership and role) is enforced inside
 * {@link WorkspaceService}, so a route cannot forget it. Controllers only parse input and
 * shape output.
 */
import type { FastifyInstance, preHandlerAsyncHookHandler } from "fastify";
import { z } from "zod";
import {
  ChangeMemberRoleRequestSchema,
  CreateWorkspaceRequestSchema,
  InviteMemberRequestSchema,
  PaginationQuerySchema,
} from "shared-types";
import { requireAuth } from "@/middlewares/authenticate";
import type { WorkspaceService } from "@/services/workspace.service";

/** The slice of {@link WorkspaceService} the controller depends on (Interface Segregation). */
export type WorkspaceUseCases = Pick<
  WorkspaceService,
  "create" | "listForUser" | "get" | "listMembers" | "inviteMember" | "changeMemberRole"
>;

/** Collaborators for {@link registerWorkspaceRoutes}. */
export interface WorkspaceRouteOptions {
  workspaces: WorkspaceUseCases;
  authenticate: preHandlerAsyncHookHandler;
}

const IdSchema = z.string().min(1).max(64);
const WorkspaceParams = z.object({ workspaceId: IdSchema });
const MemberParams = z.object({ workspaceId: IdSchema, memberId: IdSchema });

/**
 * Registers workspace and member routes:
 * `POST/GET /workspaces`, `GET /workspaces/:workspaceId`,
 * `GET/POST /workspaces/:workspaceId/members`, `PATCH /workspaces/:workspaceId/members/:memberId`.
 *
 * @param app - Fastify instance.
 * @param options - Service and authentication hook.
 * @returns Nothing.
 * @throws ZodError (rendered as 400) for invalid input; AppError 401/403/404/409 from the
 * authentication hook and the service.
 */
export function registerWorkspaceRoutes(
  app: FastifyInstance,
  options: WorkspaceRouteOptions,
): void {
  const { workspaces, authenticate } = options;

  // Encapsulated scope so the auth hook applies to exactly these routes.
  void app.register(async (scope) => {
    scope.addHook("preHandler", authenticate);

    scope.post("/workspaces", async (request, reply) => {
      const body = CreateWorkspaceRequestSchema.parse(request.body);
      const created = await workspaces.create(requireAuth(request).userId, body);
      return reply.status(201).send(created);
    });

    scope.get("/workspaces", async (request) => {
      const query = PaginationQuerySchema.parse(request.query);
      return workspaces.listForUser(requireAuth(request).userId, query);
    });

    scope.get("/workspaces/:workspaceId", async (request) => {
      const { workspaceId } = WorkspaceParams.parse(request.params);
      return workspaces.get(requireAuth(request).userId, workspaceId);
    });

    scope.get("/workspaces/:workspaceId/members", async (request) => {
      const { workspaceId } = WorkspaceParams.parse(request.params);
      const query = PaginationQuerySchema.parse(request.query);
      return workspaces.listMembers(requireAuth(request).userId, workspaceId, query);
    });

    scope.post("/workspaces/:workspaceId/members", async (request, reply) => {
      const { workspaceId } = WorkspaceParams.parse(request.params);
      const body = InviteMemberRequestSchema.parse(request.body);
      const member = await workspaces.inviteMember(requireAuth(request).userId, workspaceId, body);
      return reply.status(201).send(member);
    });

    scope.patch("/workspaces/:workspaceId/members/:memberId", async (request) => {
      const { workspaceId, memberId } = MemberParams.parse(request.params);
      const body = ChangeMemberRoleRequestSchema.parse(request.body);
      return workspaces.changeMemberRole(requireAuth(request).userId, workspaceId, memberId, body);
    });
  });
}
