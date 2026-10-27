/**
 * @file app.ts
 * @description Application factory. Builds a fully configured Fastify instance without
 * listening on a port or opening connections, so tests can drive it with `app.inject()`
 * and `index.ts` stays a thin composition root.
 */
import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthRoutes, type AuthUseCases } from "@/controllers/auth.controller";
import { registerHealthRoutes } from "@/controllers/health.controller";
import type { Env } from "@/config/env";
import { createAuthenticate } from "@/middlewares/authenticate";
import { registerErrorHandling } from "@/middlewares/error-handler";
import type { AccessTokenService } from "@/security/access-token";
import type { ReadinessService } from "@/services/readiness.service";

/** Header used to accept and echo a correlation id across services. */
const REQUEST_ID_HEADER = "x-request-id";

/** Only the configuration the app factory needs (Interface Segregation). */
export type AppConfig = Pick<Env, "WEB_ORIGIN" | "LOG_LEVEL" | "NODE_ENV">;

/** Collaborators injected into the app (Dependency Inversion). */
export interface AppDependencies {
  readiness: ReadinessService;
  auth: AuthUseCases;
  accessTokens: AccessTokenService;
}

/**
 * Builds the Fastify app.
 *
 * @param config - Validated runtime configuration.
 * @param deps - Injected collaborators.
 * @returns A ready (not yet listening) Fastify instance.
 * @throws Error if a plugin fails to register.
 * @sideEffects Registers CORS restricted to the web origin, security headers, request-id
 * propagation, cookie parsing, the central error handler, health routes and auth routes. Auth headers and cookies are redacted from logs.
 */
export async function buildApp(config: AppConfig, deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Credentials must never be written to logs.
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    // Reuse an upstream correlation id when present so one id follows a request across
    // services; otherwise mint one. It is a log field only, never trusted for authorization.
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId: () => randomUUID(),
  });

  await app.register(helmet);
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(cookie);

  app.addHook("onSend", async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
  });

  registerErrorHandling(app);
  registerHealthRoutes(app, deps.readiness);
  registerAuthRoutes(app, {
    auth: deps.auth,
    authenticate: createAuthenticate(deps.accessTokens),
    secureCookies: config.NODE_ENV === "production",
  });

  return app;
}
