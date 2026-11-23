import type { DateGranularity, Dayjs } from "@vef-framework-react/shared";

import {
  formatDate,
  formatDateByGranularity,
  parseDate,
  tryParseDate,
  tryParseDateByGranularity
} from "@vef-framework-react/shared";

/**
 * Value-format adapters shared by the mobile date / datetime / daterange fields.
 *
 * The per-key value is shared across the PC and mobile presentations, so these
 * helpers MUST read and write the exact serialized string shape the PC
 * `date-field` stores, using `@vef-framework-react/shared` format/parse helpers
 * so both presentations round-trip byte-identically. They never leak a raw
 * `Date` or an ISO string into form state.
 */

/**
 * Parse a stored datetime string back into the `Date` an antd-mobile picker
 * seeds from. Returns `null` for empty or unparseable input.
 */
export function toPickerDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  return tryParseDate(value)?.toDate() ?? null;
}

/**
 * Serialize a picker's confirmed `Date` into the stored string, using the same
 * `parseDate` → `formatDate` path as the PC field so the two presentations
 * round-trip byte-identically.
 */
export function fromPickerDate(date: Date, format: string): string {
  return formatDate(parseDate(date), format);
}

/**
 * Display string for a datetime trigger: the value reformatted through the
 * shared parser, falling back to the empty string when absent or unparseable.
 */
export function formatTrigger(value: string, format: string): string {
  if (!value) {
    return "";
  }

  const parsed: Dayjs | null = tryParseDate(value);
  return parsed ? formatDate(parsed, format) : "";
}

/**
 * Parse a stored date string strictly for `granularity` into a `Date` for
 * antd-mobile's `DatePicker` / `DatePickerView` / `CalendarPicker`.
 */
export function toGranularityPickerDate(value: string, granularity: DateGranularity): Date | null {
  if (!value) {
    return null;
  }

  return tryParseDateByGranularity(value, granularity)?.toDate() ?? null;
}

/**
 * Format a confirmed `Date` from antd-mobile into the canonical string for
 * `granularity` (`YYYY`, `YYYY-Qn`, `YYYY-MM`, or `YYYY-MM-DD`).
 */
export function fromGranularityPickerDate(date: Date, granularity: DateGranularity): string {
  return formatDateByGranularity(date, granularity);
}

/**
 * Format a stored date string for display on a mobile trigger strictly under
 * `granularity`, returning `""` when empty or incompatible.
 */
export function formatGranularityTrigger(value: string, granularity: DateGranularity): string {
  if (!value) {
    return "";
  }

  const parsed = tryParseDateByGranularity(value, granularity);
  return parsed ? formatDateByGranularity(parsed, granularity) : "";
}

/**
 * Current calendar value formatted in `granularity`, used to seed an empty
 * range wheel on open.
 */
export function currentGranularityValue(granularity: DateGranularity): string {
  return formatDateByGranularity(new Date(), granularity);
}

/**
 * The selectable range for the mobile date / datetime pickers.
 *
 * antd-mobile's `DatePicker` defaults to `thisYear ± 10` and **clamps the
 * seeded value into that window before rendering the wheel**
 * (`date-picker.js`'s `pickerValue` calls `bound(...)`). So a stored birth date
 * of 1980 opens the picker on today, and confirming without touching anything
 * writes today back — the trigger meanwhile still shows 1980, because it
 * formats the value directly and never goes through the picker. Dates outside
 * the window are also simply unenterable.
 *
 * The PC `DatePicker` imposes no range, and the value is shared across both
 * presentations, so the mobile pickers must not be narrower. These bounds are
 * therefore wide enough to be a non-constraint for form data while staying
 * inside the years the picker's column generator can enumerate.
 */
export const PICKER_MIN_YEAR = 1900;
export const PICKER_MAX_YEAR = 2099;
export const PICKER_MIN_DATE = new Date(PICKER_MIN_YEAR, 0, 1);
export const PICKER_MAX_DATE = new Date(PICKER_MAX_YEAR, 11, 31, 23, 59, 59);

const YEAR_OPTIONS = Array.from(
  { length: PICKER_MAX_YEAR - PICKER_MIN_YEAR + 1 },
  (_, index) => {
    const year = String(PICKER_MIN_YEAR + index);

    return { label: `${year}年`, value: year };
  }
);

const QUARTER_OPTIONS = [
  { label: "Q1", value: "1" },
  { label: "Q2", value: "2" },
  { label: "Q3", value: "3" },
  { label: "Q4", value: "4" }
];

/**
 * Two-column wheel definition (year + Q1–Q4) for the custom mobile quarter
 * `Picker` / `PickerView`, matching the `[PICKER_MIN_YEAR, PICKER_MAX_YEAR]`
 * span used by antd-mobile `DatePicker`.
 */
export const QUARTER_PICKER_COLUMNS = [YEAR_OPTIONS, QUARTER_OPTIONS];

/**
 * Parse a `YYYY-Qn` string into `[year, quarter]` wheel values, falling back
 * to the current year and quarter when empty or invalid.
 */
export function toQuarterColumnsValue(value: string): [string, string] {
  const parsed = value ? tryParseDateByGranularity(value, "quarter") : null;

  if (parsed) {
    return [String(parsed.year()).padStart(4, "0"), String(Math.floor(parsed.month() / 3) + 1)];
  }

  const now = new Date();

  return [String(now.getFullYear()).padStart(4, "0"), String(Math.floor(now.getMonth() / 3) + 1)];
}

/**
 * Serialize `[year, quarter]` wheel values back into `YYYY-Qn`, or `""` when
 * incomplete.
 */
export function fromQuarterColumnsValue(columns: ReadonlyArray<string | number | null | undefined>): string {
  const [rawYear, rawQuarter] = columns;
  const year = rawYear === null || rawYear === undefined ? "" : String(rawYear);

  if (!/^\d{4}$/.test(year)) {
    return "";
  }

  const quarter = rawQuarter === null || rawQuarter === undefined ? "" : String(rawQuarter);

  if (quarter !== "1" && quarter !== "2" && quarter !== "3" && quarter !== "4") {
    return "";
  }

  return `${year}-Q${quarter}`;
}
