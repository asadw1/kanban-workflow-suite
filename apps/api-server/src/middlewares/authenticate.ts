/**
 * @file authenticate.ts
 * @description Bearer-token authentication for REST routes. Verifies the JWT from the
 * `Authorization` header and attaches the caller identity to the request. It answers only
 * "who is calling"; "what may they do" is decided by the RBAC guard against WorkspaceMember.
 */
import type { FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import { AppError } from "@/errors/app-error";
import type { AccessTokenService } from "@/security/access-token";

/** Identity of the authenticated caller. */
export interface AuthContext {
  userId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Set by {@link createAuthenticate}; absent on unauthenticated routes. */
    auth?: AuthContext;
  }
}

const BEARER_PREFIX = "Bearer ";

/**
 * Builds the authentication pre-handler.
 *
 * @param tokens - Verifier for access tokens.
 * @returns A Fastify pre-handler to attach to protected routes.
 * @throws AppError 401 `UNAUTHENTICATED` (from the handler) when the header is missing,
 * malformed, or the token is invalid or expired.
 * @sideEffects Sets `request.auth` on success.
 */
export function createAuthenticate(tokens: AccessTokenService): preHandlerAsyncHookHandler {
  return async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith(BEARER_PREFIX)) {
      throw new AppError(401, "UNAUTHENTICATED", "Missing bearer token.");
    }
    const { userId } = await tokens.verify(header.slice(BEARER_PREFIX.length));
    request.auth = { userId };
  };
}

/**
 * Reads the caller identity inside a protected handler.
 *
 * @param request - The current request.
 * @returns The authenticated identity.
 * @throws AppError 401 if the route was registered without the authenticate pre-handler, which
 * fails closed instead of treating the caller as anonymous.
 */
export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
  return request.auth;
}
