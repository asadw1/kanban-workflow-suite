/**
 * @file health.controller.ts
 * @description Liveness and readiness endpoints. These are deliberately unauthenticated
 * (orchestrators call them) and expose only up/down status, never error details.
 */
import type { FastifyInstance } from "fastify";
import type { ReadinessService } from "@/services/readiness.service";

/**
 * Registers `GET /health/live` and `GET /health/ready`.
 *
 * Liveness means "the process is running" and checks no dependency, so a database outage
 * does not make the orchestrator restart healthy pods. Readiness means "safe to receive
 * traffic" and returns 503 when any dependency is down.
 *
 * @param app - Fastify instance to register on.
 * @param readiness - Service that evaluates dependency probes.
 * @returns Nothing.
 */
export function registerHealthRoutes(app: FastifyInstance, readiness: ReadinessService): void {
  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_request, reply) => {
    const report = await readiness.evaluate();
    return reply.status(report.ready ? 200 : 503).send(report);
  });
}
