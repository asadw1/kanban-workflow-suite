/**
 * @file auth.controller.ts
 * @description HTTP transport for authentication: register, login, refresh, logout and
 * "who am I". Controllers only parse input, call the service and shape the response. The
 * refresh token travels exclusively in an httpOnly cookie scoped to `/auth`, so scripts in the
 * page can never read it (XSS cannot exfiltrate it) and it is not sent to other routes.
 */
import type { FastifyInstance, FastifyReply, preHandlerAsyncHookHandler } from "fastify";
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  type AuthResponse,
  type UserDto,
} from "shared-types";
import { AppError } from "@/errors/app-error";
import { requireAuth } from "@/middlewares/authenticate";
import type { AuthService, AuthSession } from "@/services/auth.service";

/** The slice of {@link AuthService} the controller depends on (Interface Segregation). */
export type AuthUseCases = Pick<
  AuthService,
  "register" | "login" | "refresh" | "logout" | "getProfile"
>;

/** Collaborators and settings for {@link registerAuthRoutes}. */
export interface AuthRouteOptions {
  auth: AuthUseCases;
  /** Pre-handler that authenticates the bearer token for protected routes. */
  authenticate: preHandlerAsyncHookHandler;
  /** Adds the `Secure` cookie flag; must be true outside local development. */
  secureCookies: boolean;
}

const REFRESH_COOKIE = "refresh_token";
const COOKIE_PATH = "/auth";

/**
 * Registers `/auth/*` routes.
 *
 * @param app - Fastify instance (the cookie plugin must already be registered).
 * @param options - Service, authentication hook and cookie policy.
 * @returns Nothing.
 * @throws ZodError (rendered as 400) for invalid bodies; AppError 401 for bad credentials or
 * refresh tokens, 409 for a taken email.
 * @sideEffects Sets and clears the refresh-token cookie.
 */
export function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): void {
  const { auth, authenticate, secureCookies } = options;

  /** Writes the refresh cookie and builds the JSON body from a session. */
  const respondWithSession = (reply: FastifyReply, session: AuthSession): AuthResponse => {
    reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: secureCookies,
      // Strict: the refresh endpoint is only ever called by scripts on our own origin.
      sameSite: "strict",
      path: COOKIE_PATH,
      expires: session.refreshExpiresAt,
    });
    // Responses carrying tokens must never be stored by browsers or proxies.
    reply.header("cache-control", "no-store");
    return { accessToken: session.accessToken, user: session.user };
  };

  app.post("/auth/register", async (request, reply) => {
    const body = RegisterRequestSchema.parse(request.body);
    return reply.status(201).send(respondWithSession(reply, await auth.register(body)));
  });

  app.post("/auth/login", async (request, reply) => {
    const body = LoginRequestSchema.parse(request.body);
    return respondWithSession(reply, await auth.login(body));
  });

  app.post("/auth/refresh", async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (!token) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.");
    }
    try {
      return respondWithSession(reply, await auth.refresh(token));
    } catch (error) {
      // A refused token is dead; clear it so the browser stops replaying it. A 409 duplicate
      // is the exception: the winning request just set a fresh cookie, and clearing here
      // would delete it and log the user out.
      if (!(error instanceof AppError && error.code === "REFRESH_IN_PROGRESS")) {
        reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
      }
      throw error;
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (token) await auth.logout(token);
    reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    return reply.status(204).send();
  });

  app.get("/auth/me", { preHandler: authenticate }, async (request): Promise<UserDto> => {
    return auth.getProfile(requireAuth(request).userId);
  });
}
