import type { FullAudited } from "./base";
import type { ConcurrencyPolicy, MisfirePolicy, TriggerKind } from "./enums";
import type { JsonObject } from "./json";

/**
 * A durable schedule row from `sys/cron/schedule`. Timestamps are naive local
 * wall-clock strings (`YYYY-MM-DD HH:mm:ss`). Mirrors the Go `cron.Schedule`
 * projection.
 */
export interface Schedule extends FullAudited {
  name: string;
  jobName: string;
  kind: TriggerKind;
  expr: string;
  timezone: string;
  everyMs: number;
  fireAt?: string;
  startsAt?: string;
  endsAt?: string;
  params?: JsonObject;
  misfirePolicy: MisfirePolicy;
  concurrencyPolicy: ConcurrencyPolicy;
  recover: boolean;
  timeoutMs: number;
  isEnabled: boolean;
  nextFireAt?: string;
  lastFireAt?: string;
}

/**
 * The trigger definition submitted with a schedule save. Only the fields the
 * chosen `kind` needs are populated: `cron` → `expr` (+ optional `timezone`),
 * `interval` → `everyMs` (fixed rate, min 1000), `once` → `at` (a DateTime).
 */
export interface TriggerParams {
  kind: TriggerKind;
  expr?: string;
  timezone?: string;
  everyMs?: number;
  at?: string;
}

/**
 * Create/update parameters for a schedule. Addressing is by `name`; on update
 * an optional `newName` renames the schedule.
 */
export interface ScheduleParams {
  name: string;
  newName?: string;
  jobName: string;
  trigger: TriggerParams;
  params?: JsonObject;
  startsAt?: string;
  endsAt?: string;
  misfirePolicy?: MisfirePolicy;
  concurrencyPolicy?: ConcurrencyPolicy;
  recover?: boolean;
  timeoutMs?: number;
  enabled?: boolean;
}

/**
 * Search parameters for schedules. `isEnabled` is a `"true"` / `"false"`
 * toggle string — framework select values are strings — which `findPage`
 * converts to the boolean the wire eq filter expects.
 */
export interface ScheduleSearch {
  name?: string;
  jobName?: string;
  kind?: TriggerKind;
  isEnabled?: string;
}

/**
 * Addressing payload for the name-keyed schedule actions (get / delete /
 * pause / resume / trigger_now).
 */
export interface ScheduleNameParams {
  name: string;
}

/**
 * The `get` result: the schedule plus a preview of its next fire times (empty
 * when the schedule is paused or spent).
 */
export interface ScheduleDetail {
  schedule: Schedule;
  nextFires: string[];
}

/**
 * Parameters for the `preview_fires` probe. The trigger is validated exactly
 * like a save, so an invalid expression comes back as a business error.
 */
export interface PreviewFiresParams {
  trigger: TriggerParams;
  startsAt?: string;
  endsAt?: string;
}

/**
 * The `preview_fires` result: the next fire times inside the effective window.
 */
export interface PreviewFiresResult {
  nextFires: string[];
}
