/**
 * A selectable time unit paired with its size in milliseconds. Used by the
 * interval trigger editor and the timeout editor to present a value+unit input
 * over a single millisecond-valued field.
 */
export interface DurationUnit {
  label: string;
  value: string;
  ms: number;
}

/**
 * Units for the fixed-rate interval trigger (`everyMs`).
 */
export const INTERVAL_UNITS: DurationUnit[] = [
  {
    label: "秒",
    value: "second",
    ms: 1000
  },
  {
    label: "分钟",
    value: "minute",
    ms: 60_000
  },
  {
    label: "小时",
    value: "hour",
    ms: 3_600_000
  },
  {
    label: "天",
    value: "day",
    ms: 86_400_000
  }
];

/**
 * Units for the per-run timeout (`timeoutMs`).
 */
export const TIMEOUT_UNITS: DurationUnit[] = [
  {
    label: "毫秒",
    value: "ms",
    ms: 1
  },
  {
    label: "秒",
    value: "second",
    ms: 1000
  },
  {
    label: "分钟",
    value: "minute",
    ms: 60_000
  }
];

/**
 * Combine a value expressed in `unit` into milliseconds. An unknown unit falls
 * back to the first (smallest) unit; a negative value clamps to zero.
 */
export function combineDurationMs(value: number, unit: string, units: DurationUnit[]): number {
  const found = units.find(candidate => candidate.value === unit) ?? units[0];
  const factor = found?.ms ?? 1;

  return Math.max(0, Math.round(value)) * factor;
}

/**
 * Split milliseconds into the coarsest unit that divides it evenly, so a saved
 * `everyMs`/`timeoutMs` round-trips to the most readable value+unit. Zero maps
 * to the smallest unit with a zero value; a value divisible by no unit falls
 * back to the smallest unit.
 */
export function splitDurationMs(ms: number, units: DurationUnit[]): { value: number; unit: string } {
  const normalized = Math.max(0, Math.round(ms));
  const smallest = units[0] ?? {
    label: "",
    value: "",
    ms: 1
  };

  if (normalized === 0) {
    return { value: 0, unit: smallest.value };
  }

  for (let index = units.length - 1; index >= 0; index--) {
    const unit = units[index];

    if (unit && unit.ms <= normalized && normalized % unit.ms === 0) {
      return { value: normalized / unit.ms, unit: unit.value };
    }
  }

  return { value: normalized / smallest.ms, unit: smallest.value };
}
