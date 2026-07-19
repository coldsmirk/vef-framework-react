import type { CreationAudited } from "./base";
import type { RunStatus } from "./enums";

/**
 * One journaled run of a schedule from `sys/cron/run`. Read-only. Timestamps
 * are naive local wall-clock strings. Mirrors the Go `cron.Run` projection.
 */
export interface Run extends CreationAudited {
  scheduleId: string;
  scheduleName: string;
  jobName: string;
  scheduledAt: string;
  status: RunStatus;
  nodeId: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs: number;
  heartbeatAt?: string;
  error?: string;
  missedCount?: number;
}

/**
 * Search parameters for runs. `scheduledAtFrom` / `scheduledAtTo` bound the
 * scheduled time (gte / lte).
 */
export interface RunSearch {
  scheduleName?: string;
  jobName?: string;
  status?: RunStatus;
  nodeId?: string;
  scheduledAtFrom?: string;
  scheduledAtTo?: string;
}

/**
 * Addressing payload for the single-run fetch (`find_one`).
 */
export interface RunIdParams {
  id: string;
}
