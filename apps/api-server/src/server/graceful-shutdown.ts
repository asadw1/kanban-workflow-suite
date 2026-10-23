/**
 * @file graceful-shutdown.ts
 * @description Ordered, idempotent shutdown so deploys and scale-down drain in-flight
 * requests instead of dropping them. Kept free of `process` so it can be unit tested.
 */

/** A named resource to release during shutdown. */
export interface ShutdownTask {
  name: string;
  close(): Promise<void>;
}

/** Collaborators for {@link createShutdownHandler}. */
export interface ShutdownOptions {
  /** Tasks run sequentially in order: stop accepting traffic first, then release data stores. */
  tasks: readonly ShutdownTask[];
  /** Hard deadline after which `onForceExit` fires so a stuck task cannot hang the pod. */
  timeoutMs: number;
  log: (message: string) => void;
  /** Called with the exit code once shutdown finishes or times out. */
  exit: (code: number) => void;
}

/**
 * Creates a shutdown handler for signal listeners.
 *
 * @param options - Tasks, deadline and side-effect hooks.
 * @returns An async function taking the signal name. Calling it again while shutdown is
 * already running is a no-op, since orchestrators often send repeated signals.
 * @sideEffects Runs every task even if an earlier one fails, then calls `exit` with 0 on
 * success or 1 if any task failed or the deadline passed.
 */
export function createShutdownHandler(options: ShutdownOptions): (signal: string) => Promise<void> {
  let started = false;

  return async (signal) => {
    if (started) return;
    started = true;
    options.log(`received ${signal}, shutting down`);

    const deadline = setTimeout(() => {
      options.log("shutdown timed out, forcing exit");
      options.exit(1);
    }, options.timeoutMs);
    // Do not let the watchdog itself keep the event loop alive.
    deadline.unref();

    let failed = false;
    for (const task of options.tasks) {
      try {
        await task.close();
        options.log(`closed ${task.name}`);
      } catch (error) {
        failed = true;
        options.log(`failed to close ${task.name}: ${String(error)}`);
      }
    }

    clearTimeout(deadline);
    options.exit(failed ? 1 : 0);
  };
}
