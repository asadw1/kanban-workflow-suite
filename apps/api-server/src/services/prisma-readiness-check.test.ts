/**
 * @file prisma-readiness-check.test.ts
 * @description Unit tests for the PostgreSQL readiness probe using a stubbed Prisma client.
 */
import { describe, expect, it, vi } from "vitest";
import { PrismaReadinessCheck } from "@/services/prisma-readiness-check";

describe("PrismaReadinessCheck", () => {
  it("resolves when the database answers", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ "?column?": 1 }]);
    const probe = new PrismaReadinessCheck({ $queryRaw: queryRaw } as never);
    await expect(probe.check()).resolves.toBeUndefined();
    expect(probe.name).toBe("postgres");
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it("propagates the driver error when the database is down", async () => {
    const probe = new PrismaReadinessCheck({
      $queryRaw: vi.fn().mockRejectedValue(new Error("refused")),
    } as never);
    await expect(probe.check()).rejects.toThrow("refused");
  });
});
