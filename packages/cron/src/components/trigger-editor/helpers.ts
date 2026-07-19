import type { Schedule, TriggerKind, TriggerParams } from "../../types";

import { combineDurationMs, INTERVAL_UNITS, splitDurationMs } from "../duration";

/**
 * The subset of a schedule row that describes its trigger.
 */
export type TriggerFields = Pick<Schedule, "kind" | "expr" | "timezone" | "everyMs" | "fireAt">;

/**
 * The trigger editor's UI-facing value. The interval is held as a value+unit
 * pair (converted to `everyMs` on submit) so the editor can offer human units.
 */
export interface TriggerFormValues {
  kind: TriggerKind;
  expr: string;
  timezone: string;
  intervalValue: number;
  intervalUnit: string;
  at: string;
}

/**
 * Defaults for a fresh trigger: the cron kind with an empty expression, plus
 * a once-a-minute interval prefilled for when the user switches kinds.
 */
export const DEFAULT_TRIGGER: TriggerFormValues = {
  kind: "cron",
  expr: "",
  timezone: "",
  intervalValue: 1,
  intervalUnit: "minute",
  at: ""
};

/**
 * Project a saved schedule's trigger fields into editable form values.
 */
export function triggerToFormValues(schedule: TriggerFields): TriggerFormValues {
  const interval = schedule.everyMs > 0
    ? splitDurationMs(schedule.everyMs, INTERVAL_UNITS)
    : { value: DEFAULT_TRIGGER.intervalValue, unit: DEFAULT_TRIGGER.intervalUnit };

  return {
    kind: schedule.kind,
    expr: schedule.expr ?? "",
    timezone: schedule.timezone ?? "",
    intervalValue: interval.value,
    intervalUnit: interval.unit,
    at: schedule.fireAt ?? ""
  };
}

/**
 * Convert the editor's value into the wire trigger params, keeping only the
 * fields the chosen kind needs.
 */
export function triggerFormToParams(trigger: TriggerFormValues): TriggerParams {
  switch (trigger.kind) {
    case "cron": {
      return {
        kind: "cron",
        expr: trigger.expr.trim(),
        timezone: trigger.timezone.trim() || undefined
      };
    }

    case "interval": {
      return { kind: "interval", everyMs: combineDurationMs(trigger.intervalValue, trigger.intervalUnit, INTERVAL_UNITS) };
    }

    case "once": {
      return { kind: "once", at: trigger.at };
    }
  }
}

/**
 * Whether the trigger has enough filled in to preview: a cron expression, an
 * interval of at least the 1000ms floor, or a chosen once time.
 */
export function isTriggerComplete(trigger: TriggerFormValues): boolean {
  switch (trigger.kind) {
    case "cron": {
      return trigger.expr.trim().length > 0;
    }

    case "interval": {
      return combineDurationMs(trigger.intervalValue, trigger.intervalUnit, INTERVAL_UNITS) >= 1000;
    }

    case "once": {
      return trigger.at.trim().length > 0;
    }
  }
}

/**
 * A one-line, humanized trigger summary for a schedule row: the cron
 * expression (with timezone), the interval rate, or the single fire time.
 */
export function formatTriggerSummary(schedule: TriggerFields): string {
  switch (schedule.kind) {
    case "cron": {
      const expr = schedule.expr?.trim() || "-";

      return schedule.timezone ? `${expr}（${schedule.timezone}）` : expr;
    }

    case "interval": {
      const { value, unit } = splitDurationMs(schedule.everyMs, INTERVAL_UNITS);
      const label = INTERVAL_UNITS.find(candidate => candidate.value === unit)?.label ?? "";

      return `每 ${value} ${label}`;
    }

    case "once": {
      return schedule.fireAt ? `单次 · ${schedule.fireAt}` : "单次";
    }
  }
}
