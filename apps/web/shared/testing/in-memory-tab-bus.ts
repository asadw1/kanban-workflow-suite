/**
 * @file in-memory-tab-bus.ts
 * @description Test double that simulates several browser tabs sharing one lock and one
 * broadcast channel, so cross-tab session behaviour can be tested deterministically.
 * Excluded from coverage (test support).
 */
import type {
  CrossTabCoordinator,
  SessionMessage,
} from "@/shared/services/cross-tab-coordinator.types";

/** A shared "browser" that hands out one coordinator per simulated tab. */
export class InMemoryTabBus {
  private readonly handlers = new Map<CrossTabCoordinator, (message: SessionMessage) => void>();
  private lockTail: Promise<unknown> = Promise.resolve();

  /** @returns A coordinator for a new tab connected to this bus. */
  createTab(): CrossTabCoordinator {
    const coordinator: CrossTabCoordinator = {
      withRefreshLock: (task) => this.runExclusive(task),
      publish: (message) => {
        for (const [other, handler] of this.handlers) {
          // BroadcastChannel never echoes to the sender and delivers asynchronously.
          if (other !== coordinator) queueMicrotask(() => handler(message));
        }
      },
      subscribe: (handler) => {
        this.handlers.set(coordinator, handler);
        return () => this.handlers.delete(coordinator);
      },
    };
    return coordinator;
  }

  /** Mutual exclusion across every tab on the bus, like navigator.locks. */
  private runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.lockTail.then(task, task);
    this.lockTail = run.catch(() => undefined);
    return run;
  }
}
