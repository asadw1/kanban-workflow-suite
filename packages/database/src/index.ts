/**
 * @file index.ts
 * @description Public entry point of the `database` package: the single place the Prisma
 * client is instantiated. Services receive a client through dependency injection (see
 * CLAUDE.md, Dependency Inversion); only services may use it, never controllers.
 */
import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

/**
 * Creates a new Prisma client.
 *
 * Prefer this in composition roots and tests so the client can be injected and swapped.
 *
 * @param databaseUrl - Overrides `DATABASE_URL` from the environment when provided.
 * @returns A fresh, unconnected {@link PrismaClient}; it connects lazily on first query.
 * @throws Never at construction; connection errors surface on the first query.
 */
export function createPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient(databaseUrl ? { datasourceUrl: databaseUrl } : undefined);
}
