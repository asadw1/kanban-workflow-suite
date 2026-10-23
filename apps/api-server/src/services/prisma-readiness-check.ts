/**
 * @file prisma-readiness-check.ts
 * @description Readiness probe for PostgreSQL. Lives in `services/` because only services
 * may touch the Prisma client.
 */
import type { PrismaClient } from "database";
import type { ReadinessCheck } from "@/services/readiness.service";

/** Probes PostgreSQL with a trivial query through the injected Prisma client. */
export class PrismaReadinessCheck implements ReadinessCheck {
  readonly name = "postgres";

  /** @param prisma - Client to probe; injected so tests can pass a stub. */
  constructor(private readonly prisma: Pick<PrismaClient, "$queryRaw">) {}

  /**
   * @returns Resolves when the database answers.
   * @throws The underlying driver error when the database is unreachable.
   */
  async check(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
