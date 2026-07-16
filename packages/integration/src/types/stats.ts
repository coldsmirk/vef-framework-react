import type { Direction, FailureKind } from "./enums";

/**
 * Per-node aggregate of the invocations of one (system, contract, direction)
 * tuple since process start. Mirrors the Go `integration.InvocationStats`.
 */
export interface InvocationStats {
  system: string;
  contract: string;
  direction: Direction;
  calls: number;
  successes: number;
  failures?: Partial<Record<FailureKind, number>>;
  avgDurationMs: number;
  maxDurationMs: number;
  lastError?: string;
  lastErrorAt?: string;
}

/**
 * The `sys/monitor.get_integration_stats` response envelope.
 */
export interface IntegrationStatsResult {
  stats: InvocationStats[];
}
