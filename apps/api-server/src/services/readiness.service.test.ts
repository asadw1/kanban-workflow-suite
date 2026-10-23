/**
 * @file readiness.service.test.ts
 * @description Unit tests for readiness aggregation, including timeout handling.
 */
import { describe, expect, it } from "vitest";
import { ReadinessService, type ReadinessCheck } from "@/services/readiness.service";

describe("ReadinessService", () => {
  it("is ready when there are no checks", async () => {
    expect(await new ReadinessService([]).evaluate()).toEqual({ ready: true, checks: {} });
  });

  it("marks only the failing dependency as down", async () => {
    const checks: ReadinessCheck[] = [
      { name: "postgres", check: async () => undefined },
      {
        name: "redis",
        check: async () => {
          throw new Error("down");
        },
      },
    ];
    const report = await new ReadinessService(checks).evaluate();
    expect(report).toEqual({ ready: false, checks: { postgres: "up", redis: "down" } });
  });

  it("treats a hung probe as down once the timeout elapses", async () => {
    const hung: ReadinessCheck = { name: "postgres", check: () => new Promise(() => undefined) };
    const report = await new ReadinessService([hung], 20).evaluate();
    expect(report.checks.postgres).toBe("down");
  });
});
