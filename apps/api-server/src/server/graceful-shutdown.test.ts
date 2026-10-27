/**
 * @file graceful-shutdown.test.ts
 * @description Unit tests for ordered, idempotent shutdown.
 */
import { describe, expect, it, vi } from "vitest";
import { createShutdownHandler } from "@/server/graceful-shutdown";

function setup(tasks: { name: string; close: () => Promise<void> }[]) {
  const exit = vi.fn();
  const handler = createShutdownHandler({ tasks, timeoutMs: 1000, log: () => undefined, exit });
  return { exit, handler };
}

describe("createShutdownHandler", () => {
  it("closes tasks in order and exits 0", async () => {
    const order: string[] = [];
    const { exit, handler } = setup([
      { name: "http", close: async () => void order.push("http") },
      { name: "db", close: async () => void order.push("db") },
    ]);
    await handler("SIGTERM");
    expect(order).toEqual(["http", "db"]);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("keeps closing remaining tasks after a failure and exits 1", async () => {
    const closeDb = vi.fn(async () => undefined);
    const { exit, handler } = setup([
      {
        name: "http",
        close: async () => {
          throw new Error("boom");
        },
      },
      { name: "db", close: closeDb },
    ]);
    await handler("SIGTERM");
    expect(closeDb).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("ignores repeated signals", async () => {
    const close = vi.fn(async () => undefined);
    const { exit, handler } = setup([{ name: "http", close }]);
    await Promise.all([handler("SIGTERM"), handler("SIGINT")]);
    expect(close).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
  });

  it("forces exit 1 when a task outlives the deadline", async () => {
    vi.useFakeTimers();
    try {
      const exit = vi.fn();
      const logs: string[] = [];
      const handler = createShutdownHandler({
        tasks: [{ name: "stuck", close: () => new Promise<void>(() => undefined) }],
        timeoutMs: 500,
        log: (message) => void logs.push(message),
        exit,
      });
      void handler("SIGTERM");
      await vi.advanceTimersByTimeAsync(500);
      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(logs).toContain("shutdown timed out, forcing exit");
    } finally {
      vi.useRealTimers();
    }
  });
});
