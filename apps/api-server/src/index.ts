/**
 * @file index.ts
 * @description API server composition root: loads configuration, wires dependencies, starts
 * listening and installs signal handlers. All logic lives in injected modules; this file only
 * connects them. The Socket.io gateway is attached here in the Stage 3 roadmap items.
 */
import { createPrismaClient } from "database";
import { buildApp } from "@/app";
import { loadEnv } from "@/config/env";
import { PrismaReadinessCheck } from "@/services/prisma-readiness-check";
import { ReadinessService } from "@/services/readiness.service";
import { createShutdownHandler } from "@/server/graceful-shutdown";

/** Maximum time to drain in-flight work before forcing exit; below typical pod grace periods. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

const env = loadEnv();
const prisma = createPrismaClient(env.DATABASE_URL);
const app = await buildApp(env, {
  readiness: new ReadinessService([new PrismaReadinessCheck(prisma)]),
});

const shutdown = createShutdownHandler({
  // Stop accepting requests before closing the database they depend on.
  tasks: [
    { name: "http server", close: () => app.close() },
    { name: "database", close: () => prisma.$disconnect() },
  ],
  timeoutMs: SHUTDOWN_TIMEOUT_MS,
  log: (message) => app.log.info(message),
  exit: (code) => process.exit(code),
});

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (error) {
  app.log.fatal({ err: error }, "failed to start");
  process.exit(1);
}
