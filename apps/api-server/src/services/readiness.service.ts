/**
 * @file readiness.service.ts
 * @description Aggregates dependency probes (PostgreSQL, later Redis) into a readiness report
 * for orchestrators. Probes are injected through the {@link ReadinessCheck} abstraction so
 * new dependencies are added by registering a check, not by editing this service.
 */

/** A single dependency probe. Implementations must be cheap and side-effect free. */
export interface ReadinessCheck {
  /** Stable name reported in the readiness body, for example `postgres`. */
  readonly name: string;
  /**
   * Verifies the dependency is reachable.
   *
   * @returns Resolves when healthy.
   * @throws Any error when the dependency is unavailable.
   */
  check(): Promise<void>;
}

/** Result of evaluating all checks. Contains no error text, only up/down per dependency. */
export interface ReadinessReport {
  ready: boolean;
  checks: Record<string, "up" | "down">;
}

/** Evaluates registered {@link ReadinessCheck}s concurrently with a per-check timeout. */
export class ReadinessService {
  /**
   * @param checks - Probes to run on every evaluation.
   * @param timeoutMs - Maximum time any one probe may take before it counts as down.
   */
  constructor(
    private readonly checks: readonly ReadinessCheck[],
    private readonly timeoutMs = 2000,
  ) {}

  /**
   * Runs every probe in parallel.
   *
   * @returns A report; `ready` is true only when every probe is up.
   * @throws Never: probe failures and timeouts are reported as `down`.
   */
  async evaluate(): Promise<ReadinessReport> {
    const results = await Promise.all(
      this.checks.map(async (probe) => [probe.name, await this.run(probe)] as const),
    );
    return {
      ready: results.every(([, status]) => status === "up"),
      checks: Object.fromEntries(results),
    };
  }

  /** Races a probe against the timeout, always clearing the timer to avoid leaking handles. */
  private async run(probe: ReadinessCheck): Promise<"up" | "down"> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("readiness check timed out")), this.timeoutMs);
    });
    try {
      await Promise.race([probe.check(), timeout]);
      return "up";
    } catch {
      return "down";
    } finally {
      clearTimeout(timer);
    }
  }
}
