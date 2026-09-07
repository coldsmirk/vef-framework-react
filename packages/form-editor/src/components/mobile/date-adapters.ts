import type { Dayjs } from "@vef-framework-react/shared";

import { formatDate, parseDate, tryParseDate } from "@vef-framework-react/shared";

/**
 * Value-format adapters shared by the mobile date / datetime / daterange fields.
 *
 * The per-key value is shared across the PC and mobile presentations, so these
 * helpers MUST read and write the exact serialized string shape the PC
 * `date-field` stores: `formatDate(parseDate(date), format)` on the way out and
 * `tryParseDate(value)` on the way in. They never leak a raw `Date` or an ISO
 * string into form state.
 */

/**
 * Parse a stored date string back into the `Date` an antd-mobile picker seeds
 * from. Returns `null` for empty or unparseable input so the picker opens with
 * no preselection (and the trigger shows its placeholder).
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
 * Display string for a trigger: the value reformatted through the shared
 * parser, falling back to the empty string when absent or unparseable. Going
 * through `tryParseDate` normalizes any accepted input shape to the field's
 * canonical format for display.
 */
export function formatTrigger(value: string, format: string): string {
  if (!value) {
    return "";
  }

  const parsed: Dayjs | null = tryParseDate(value);
  return parsed ? formatDate(parsed, format) : "";
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
 *
 * Not applicable to the daterange field: it renders a `CalendarPicker`, whose
 * defaults carry no bounds.
 */
export const PICKER_MIN_DATE = new Date(1900, 0, 1);
export const PICKER_MAX_DATE = new Date(2099, 11, 31, 23, 59, 59);
