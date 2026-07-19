/**
 * The typed vocabularies the durable cron store shares with the management UI.
 * Each mirrors a Go enum verbatim and must stay in lockstep with it; display
 * labels and colors live with the presentation components, not here.
 */

/**
 * How a schedule computes its fire times. `cron` uses a 5- or 6-field cron
 * expression (or an `@daily`-style descriptor); `interval` fires at a fixed
 * rate; `once` fires a single time.
 */
export const TRIGGER_KINDS = ["cron", "interval", "once"] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

/**
 * What to do with occurrences missed while a node was down or the schedule was
 * paused: `fire_now` runs the gap once immediately, `skip` drops it.
 */
export const MISFIRE_POLICIES = ["fire_now", "skip"] as const;
export type MisfirePolicy = (typeof MISFIRE_POLICIES)[number];

/**
 * Whether a new occurrence may start while the previous run is still going:
 * `forbid` skips the overlap, `allow` runs them in parallel.
 */
export const CONCURRENCY_POLICIES = ["forbid", "allow"] as const;
export type ConcurrencyPolicy = (typeof CONCURRENCY_POLICIES)[number];

/**
 * The lifecycle status of one journaled run.
 */
export const RUN_STATUSES = [
  "running",
  "succeeded",
  "failed",
  "missed",
  "skipped",
  "abandoned",
  "canceled"
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
