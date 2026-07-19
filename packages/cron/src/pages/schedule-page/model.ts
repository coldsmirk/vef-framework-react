import type { TriggerFormValues } from "../../components";
import type { ConcurrencyPolicy, JsonObject, MisfirePolicy, Schedule, ScheduleParams } from "../../types";

import {
  combineDurationMs,
  DEFAULT_TRIGGER,
  splitDurationMs,
  TIMEOUT_UNITS,
  triggerFormToParams,
  triggerToFormValues
} from "../../components";

/**
 * The schedule form's values. The trigger is held in the editor's value+unit
 * shape, the timeout as a value+unit pair, and `params` as raw JSON text — all
 * collapsed to the API model on submit. `originalName` is the addressing name
 * captured when editing, so a changed `name` becomes a rename (`newName`).
 */
export interface ScheduleFormValues {
  id?: string;
  originalName?: string;
  name: string;
  jobName: string;
  trigger: TriggerFormValues;
  startsAt: string;
  endsAt: string;
  misfirePolicy: MisfirePolicy;
  concurrencyPolicy: ConcurrencyPolicy;
  recover: boolean;
  timeoutValue: number;
  timeoutUnit: string;
  paramsText: string;
  enabled: boolean;
}

/**
 * The outcome of parsing the params textarea: an optional object when valid
 * (empty text yields no params), or a message describing why it is invalid.
 */
export type JsonParamsResult = { ok: true; value?: JsonObject } | { ok: false; error: string };

/**
 * Parse the params textarea into a JSON object. Empty text is valid and omits
 * the params entirely; anything that is not a JSON object is rejected.
 */
export function parseJsonParams(text: string): JsonParamsResult {
  const trimmed = text.trim();

  if (!trimmed) {
    return { ok: true, value: undefined };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "任务参数不是合法的 JSON" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "任务参数必须是 JSON 对象" };
  }

  return { ok: true, value: parsed as JsonObject };
}

/**
 * The field-validator form of {@link parseJsonParams}: an error message when
 * invalid, or undefined when valid.
 */
export function jsonParamsError(text: string): string | undefined {
  const result = parseJsonParams(text);

  return result.ok ? undefined : result.error;
}

/**
 * Project a saved schedule into editable form values.
 */
export function scheduleToFormValues(row: Schedule): ScheduleFormValues {
  const timeout = row.timeoutMs > 0
    ? splitDurationMs(row.timeoutMs, TIMEOUT_UNITS)
    : { value: 0, unit: "second" };

  return {
    id: row.id,
    originalName: row.name,
    name: row.name,
    jobName: row.jobName,
    trigger: triggerToFormValues(row),
    startsAt: row.startsAt ?? "",
    endsAt: row.endsAt ?? "",
    misfirePolicy: row.misfirePolicy,
    concurrencyPolicy: row.concurrencyPolicy,
    recover: row.recover,
    timeoutValue: timeout.value,
    timeoutUnit: timeout.unit,
    paramsText: row.params ? JSON.stringify(row.params, null, 2) : "",
    enabled: row.isEnabled
  };
}

/**
 * Convert the form values into the API params: address by `originalName`,
 * rename via `newName`, collapse the trigger, timeout and params.
 */
export function scheduleToParams(values: ScheduleFormValues): ScheduleParams {
  const renamed = Boolean(values.originalName) && values.originalName !== values.name;
  const params = parseJsonParams(values.paramsText);

  return {
    name: values.originalName ?? values.name,
    newName: renamed ? values.name : undefined,
    jobName: values.jobName,
    trigger: triggerFormToParams(values.trigger),
    params: params.ok ? params.value : undefined,
    startsAt: values.startsAt || undefined,
    endsAt: values.endsAt || undefined,
    misfirePolicy: values.misfirePolicy,
    concurrencyPolicy: values.concurrencyPolicy,
    recover: values.recover,
    timeoutMs: combineDurationMs(values.timeoutValue, values.timeoutUnit, TIMEOUT_UNITS),
    enabled: values.enabled
  };
}

/**
 * Defaults for a newly created schedule.
 */
export const SCHEDULE_FORM_DEFAULTS: ScheduleFormValues = {
  name: "",
  jobName: "",
  trigger: { ...DEFAULT_TRIGGER },
  startsAt: "",
  endsAt: "",
  misfirePolicy: "fire_now",
  concurrencyPolicy: "forbid",
  recover: false,
  timeoutValue: 0,
  timeoutUnit: "second",
  paramsText: "",
  enabled: true
};

export const TIMEOUT_UNIT_OPTIONS = TIMEOUT_UNITS.map(unit => {
  return { label: unit.label, value: unit.value };
});
