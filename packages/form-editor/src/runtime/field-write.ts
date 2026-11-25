import type { DateGranularity } from "@vef-framework-react/shared";

import type { WritableTargetField } from "../engine/linkage";
import type { FieldOption, FieldPermission, KeyedFormField } from "../types";
import type { RuntimeForm } from "./types";

import {
  DEFAULT_DATETIME_FORMAT,
  formatDate,
  formatDateByGranularity,
  isDeepEqual,
  isValidDateByGranularity,
  parseDate,
  tryParseDateByGranularity
} from "@vef-framework-react/shared";

import { exhaustive } from "../engine/assert-never";
import {
  getFieldPermission,
  isWritableFieldPermission,
  isWritableTargetField
} from "../engine/linkage";
import { selectableOptionsForField } from "../engine/options";

const DATETIME_INPUT_PATTERN
  = /^(?<year>\d{4})[-/.](?<month>\d{2})[-/.](?<day>\d{2})[ T](?<hour>\d{2}):(?<minute>\d{2})(?::(?<second>\d{2}))?(?:\.\d+)?(?<tz>Z|[+-]\d{2}:?\d{2})?$/;

const DAY_INPUT_PATTERN = /^(?<year>\d{4})[-/.](?<month>\d{2})[-/.](?<day>\d{2})$/;

const MONTH_INPUT_PATTERN = /^(?<year>\d{4})[-/.](?<month>\d{2})$/;

/**
 * The single gate for every programmatic form-value write: the state lane's
 * `assign` applications (`applyScopedAssignments`) and the effect lane's
 * `set_fields` both land here, so disabled forms, server permission clamps,
 * widget value normalization, and meta-free semantics hold on every write path.
 *
 * - **Disabled guard**: a disabled (read-only) form never accepts programmatic
 * writes — historical records stay untouched by linkage actions.
 * - **Permission guard**: `fieldPermissions` is the firing scope's clamp map.
 * The root scope carries the host map; subform-row scopes pass `undefined`.
 * Non-writable keys (`"visible"` / `"hidden"`) are dropped silently.
 * - **Writable target guard**: `upload` fields are never written by
 * programmatic field assignments.
 * - **Normalization**: values are normalized to the exact wire/control shape
 * matching Go's `validateFormField` (see {@link normalizeFieldValue}); broken
 * references (`undefined`) or un-normalizable values clear the target to its
 * type-appropriate empty value.
 * - **No-op bail**: writing a value deeply equal to what the target already
 * holds is dropped so TanStack Form does not mint a fresh values reference and
 * re-fire `always` rules or churn selectors.
 * - **Meta-free**: writes never run the target's onChange listeners (so
 * programmatic writes never fire `change` / `commit` triggers) or mark the
 * field touched.
 */
export function writeFieldValue(args: {
  disabled?: boolean;
  fieldPermissions: Record<string, FieldPermission> | undefined;
  form: RuntimeForm;
  /**
   * The target's key within the firing value scope.
   */
  key: string;
  /**
   * Resolved option list for selection fields, when already known (static,
   * loaded codeSet, or cached remote). Used to align option value types
   * (e.g. number `1` ↔ string `"1"`) and drop values outside a known option set.
   */
  knownOptions?: readonly FieldOption[];
  /**
   * The scope's field-name prefix: `""` at the root, `"lines[0]."` in a row.
   */
  prefix: string;
  /**
   * The declared field being written. Non-writable fields (per
   * {@link isWritableTargetField}) are rejected before normalization.
   */
  targetField: KeyedFormField;
  value: unknown;
}): void {
  if (args.disabled) {
    return;
  }

  if (!isWritableFieldPermission(getFieldPermission(args.fieldPermissions, topLevelKey(args.key)))) {
    return;
  }

  if (!isWritableTargetField(args.targetField)) {
    return;
  }

  const name = `${args.prefix}${args.key}`;
  const value = normalizeFieldValue(args.targetField, args.value, args.knownOptions);

  if (isDeepEqual(args.form.getFieldValue(name), value)) {
    return;
  }

  args.form.setFieldValue(name, value, {
    dontRunListeners: true,
    dontUpdateMeta: true
  });
}

/**
 * Normalize an arbitrary runtime value (literal, reference, expression, or API
 * response field) into the canonical value shape accepted by the target widget
 * and Go's `validateFormField`. Un-normalizable values and broken references
 * (`undefined` / `null`) resolve to the field's empty value, clearing the target
 * cleanly.
 */
export function normalizeFieldValue(
  field: WritableTargetField,
  value: unknown,
  knownOptions?: readonly FieldOption[]
): unknown {
  switch (field.type) {
    case "textfield": {
      return normalizeTextValue(value);
    }

    case "textarea": {
      return normalizeTextValue(value);
    }

    case "code-editor": {
      return normalizeTextValue(value);
    }

    case "number": {
      return normalizeNumberValue(value);
    }

    case "switch": {
      return normalizeSwitchValue(value);
    }

    case "date": {
      return normalizeDateValue(value, field.granularity ?? "day");
    }

    case "datetime": {
      return normalizeDatetimeValue(value);
    }

    case "daterange": {
      return normalizeDateRangeValue(value, field.granularity ?? "day");
    }

    case "select": {
      return normalizeSingleOptionValue(
        value,
        knownOptions === undefined ? undefined : selectableOptionsForField(field, knownOptions)
      );
    }

    case "radio": {
      return normalizeSingleOptionValue(
        value,
        knownOptions === undefined ? undefined : selectableOptionsForField(field, knownOptions)
      );
    }

    case "tree-select": {
      return normalizeSingleOptionValue(
        value,
        knownOptions === undefined ? undefined : selectableOptionsForField(field, knownOptions)
      );
    }

    case "multi-select": {
      return normalizeMultiOptionValue(
        value,
        knownOptions === undefined ? undefined : selectableOptionsForField(field, knownOptions)
      );
    }

    case "checkbox-group": {
      return normalizeMultiOptionValue(
        value,
        knownOptions === undefined ? undefined : selectableOptionsForField(field, knownOptions)
      );
    }

    case "tree-multi-select": {
      return normalizeMultiOptionValue(
        value,
        knownOptions === undefined ? undefined : selectableOptionsForField(field, knownOptions)
      );
    }

    default: {
      exhaustive(field);

      return value;
    }
  }
}

function normalizeTextValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return "";
}

function normalizeNumberValue(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return undefined;
    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeSwitchValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    return normalized === "true" || normalized === "1";
  }

  return false;
}

/**
 * Parse a structured datetime string strictly — rejecting non-calendar dates
 * (e.g. `2026-02-29`), out-of-range clock components, and arbitrary prose that
 * `new Date()` / bare `dayjs()` would coerce. Returns either a timezone-adjusted
 * local `Date` (when a timezone offset was present) or the validated local parts.
 */
function parseStrictDatetime(
  raw: string
): { kind: "zoned"; date: Date } | { kind: "local"; dateStr: string; timeStr: string } | null {
  const match = DATETIME_INPUT_PATTERN.exec(raw);

  if (!match?.groups) {
    return null;
  }

  const {
    day,
    hour,
    minute,
    month,
    second = "00",
    tz,
    year
  } = match.groups;

  if (!year || !month || !day || !hour || !minute) {
    return null;
  }

  const dateStr = `${year}-${month}-${day}`;

  if (tryParseDateByGranularity(dateStr, "day") === null) {
    return null;
  }

  const h = Number(hour);
  const m = Number(minute);
  const s = Number(second);

  if (h > 23 || m > 59 || s > 59) {
    return null;
  }

  if (tz) {
    const normalizedTz = tz === "Z" || tz.includes(":") ? tz : `${tz.slice(0, 3)}:${tz.slice(3)}`;
    const date = new Date(`${dateStr}T${hour}:${minute}:${second}${normalizedTz}`);

    return Number.isNaN(date.getTime()) ? null : { kind: "zoned", date };
  }

  return {
    kind: "local",
    dateStr,
    timeStr: `${hour}:${minute}:${second}`
  };
}

/**
 * Normalize a date input strictly to `granularity`'s canonical format without
 * fabricating finer precision from a coarser input (e.g. `"2026"` or `"2026-05"`
 * will not invent day `01` for a `"day"` field).
 */
function normalizeDateValue(value: unknown, granularity: DateGranularity): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : formatDateByGranularity(value, granularity);
  }

  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "";
  }

  if (isValidDateByGranularity(trimmed, granularity)) {
    return trimmed;
  }

  // 1. Datetime input (finest precision — projects onto any granularity).
  const datetime = parseStrictDatetime(trimmed);

  if (datetime !== null) {
    if (datetime.kind === "zoned") {
      return formatDateByGranularity(datetime.date, granularity);
    }

    const parsedDay = tryParseDateByGranularity(datetime.dateStr, "day");

    return parsedDay === null ? "" : formatDateByGranularity(parsedDay, granularity);
  }

  // 2. Full calendar day (projects onto day / month / quarter / year).
  const dayMatch = DAY_INPUT_PATTERN.exec(trimmed);

  if (dayMatch?.groups?.year && dayMatch.groups.month && dayMatch.groups.day) {
    const parsedDay = tryParseDateByGranularity(
      `${dayMatch.groups.year}-${dayMatch.groups.month}-${dayMatch.groups.day}`,
      "day"
    );

    return parsedDay === null ? "" : formatDateByGranularity(parsedDay, granularity);
  }

  // 3. Year-month (projects onto month / quarter / year, never day).
  if (granularity !== "day") {
    const monthMatch = MONTH_INPUT_PATTERN.exec(trimmed);

    if (monthMatch?.groups?.year && monthMatch.groups.month) {
      const parsedMonth = tryParseDateByGranularity(`${monthMatch.groups.year}-${monthMatch.groups.month}`, "month");

      return parsedMonth === null ? "" : formatDateByGranularity(parsedMonth, granularity);
    }
  }

  // 4. Year-quarter (projects onto quarter / year, never month or day).
  if (granularity === "quarter" || granularity === "year") {
    const parsedQuarter = tryParseDateByGranularity(trimmed, "quarter");

    if (parsedQuarter !== null) {
      return formatDateByGranularity(parsedQuarter, granularity);
    }
  }

  return "";
}

function normalizeDatetimeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : formatDate(parseDate(value), DEFAULT_DATETIME_FORMAT);
  }

  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "";
  }

  const parsed = parseStrictDatetime(trimmed);

  if (parsed === null) {
    return "";
  }

  return parsed.kind === "zoned"
    ? formatDate(parseDate(parsed.date), DEFAULT_DATETIME_FORMAT)
    : `${parsed.dateStr} ${parsed.timeStr}`;
}

function normalizeDateRangeValue(value: unknown, granularity: DateGranularity): string[] {
  if (!Array.isArray(value) || value.length !== 2) {
    return [];
  }

  const start = normalizeDateValue(value[0], granularity);
  const end = normalizeDateValue(value[1], granularity);

  if (start.length === 0 || end.length === 0 || start > end) {
    return [];
  }

  return [start, end];
}

function isOptionScalar(value: unknown): value is string | number {
  return (typeof value === "string" && value.length > 0)
    || (typeof value === "number" && Number.isFinite(value));
}

function normalizeSingleOptionValue(
  value: unknown,
  knownOptions: readonly FieldOption[] | undefined
): string | number {
  if (!isOptionScalar(value)) {
    return "";
  }

  if (knownOptions !== undefined && knownOptions.length > 0) {
    const needle = String(value);
    const matched = knownOptions.find(option => String(option.value) === needle);

    return matched === undefined ? "" : matched.value;
  }

  return value;
}

function normalizeMultiOptionValue(
  value: unknown,
  knownOptions: readonly FieldOption[] | undefined
): Array<string | number> {
  if (!Array.isArray(value)) {
    return [];
  }

  const hasKnownOptions = knownOptions !== undefined && knownOptions.length > 0;
  const seen = new Set<string>();
  const result: Array<string | number> = [];

  for (const item of value) {
    if (!isOptionScalar(item)) {
      continue;
    }

    let resolved: string | number;

    if (hasKnownOptions) {
      const needle = String(item);
      const matched = knownOptions.find(option => String(option.value) === needle);

      if (matched === undefined) {
        continue;
      }

      resolved = matched.value;
    } else {
      resolved = item;
    }

    const dedupeKey = String(resolved);

    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      result.push(resolved);
    }
  }

  return result;
}

/**
 * The first path segment of a target key. A schema-authored target is a plain
 * scope-level key, but an untrusted schema may aim a path
 * (`"lines[0].amount"`) — the clamp addresses the top-level binding, so the
 * guard resolves it the way `resolveScopeValues` tokenizes names.
 */
function topLevelKey(key: string): string {
  return key.match(/[^.[\]]+/)?.[0] ?? key;
}
