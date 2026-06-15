import type { DurationUnitType } from "dayjs/plugin/duration";

import type { MaybeNull } from "../types";

import dayjs from "dayjs";
import locale from "dayjs/locale/zh-cn";
import customParseFormat from "dayjs/plugin/customParseFormat";
import duration from "dayjs/plugin/duration";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.locale(locale);
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(duration);
dayjs.extend(relativeTime);

export type Dayjs = dayjs.Dayjs;

/**
 * Temporal picker mode type.
 * Defines the granularity of date/time selection.
 */
export type TemporalMode = "minute" | "hour" | "time" | "date" | "datetime" | "week" | "month" | "quarter" | "year";

// Common date format constants
export const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";
export const DEFAULT_TIME_FORMAT = "HH:mm:ss";
export const DEFAULT_DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
export const LOCALIZED_DATETIME_FORMAT = "LLLL";
export const LOCALIZED_DATE_FORMAT = "LLdddd";

// Temporal format patterns for different modes
const YEAR_FORMATS = ["YYYY"] as const;
const QUARTER_FORMATS = ["YYYY-Q季度"] as const;
const MONTH_FORMATS = [
  "YYYY-MM",
  "YYYY/MM",
  "YYYY.MM",
  "YYYYMM"
] as const;
const WEEK_FORMATS = ["YYYY-wo"] as const;
const DATE_FORMATS = [
  "YYYY-MM-DD",
  "YYYY/MM/DD",
  "YYYY.MM.DD",
  "YYYYMMDD",
  "YY/MM/DD",
  "YY.MM.DD",
  "YYMMDD"
] as const;
const TIME_FORMATS = ["HH:mm:ss", "HH.mm.ss", "HHmmss"] as const;
const HOUR_FORMATS = ["HH"] as const;
const MINUTE_FORMATS = ["HH:mm", "HH.mm", "HHmm"] as const;
const DATETIME_FORMATS = [
  "YYYY-MM-DD HH:mm:ss",
  "YYYY/MM/DD HH:mm:ss",
  "YYYY.MM.DD HH.mm.ss",
  "YYYYMMDDHHmmss",
  "YY/MM/DD HH:mm:ss",
  "YY.MM.DD HH:mm:ss",
  "YY.MM.DD HH.mm.ss",
  "YYMMDDHHmmss"
] as const;

/**
 * Format duration to human readable string.
 *
 * @param value - Duration value
 * @param unit - The unit of the duration (default: "seconds")
 * @returns Formatted duration string
 * @example
 * ```ts
 * formatDuration(60) // "1分钟"
 * formatDuration(3600) // "1小时0分钟"
 * formatDuration(86400) // "1天0小时0分钟"
 * formatDuration(90061) // "1天1小时1分钟"
 * ```
 */
export function formatDuration(value: number, unit: DurationUnitType = "seconds"): string {
  const duration = dayjs.duration(value, unit);
  const days = Math.floor(duration.asDays());
  const hours = duration.hours();
  const minutes = duration.minutes();

  if (days > 0) {
    return `${days}天${hours}小时${minutes}分钟`;
  }

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }

  return `${minutes}分钟`;
}

/**
 * Parses a date string into a dayjs instance with optional format.
 * When `format` is omitted, dayjs falls back to its built-in parser, which
 * accepts ISO 8601 and other common shapes (e.g. `"YYYY-MM-DD"`,
 * `"YYYY-MM-DD HH:mm:ss"`, `"YYYY-MM-DDTHH:mm:ssZ"`). Provide `format` for
 * compact or non-standard inputs that the built-in parser cannot handle.
 *
 * For inputs whose shape is unknown ahead of time, prefer `tryParseDate`,
 * which returns `null` on failure instead of an invalid Dayjs.
 *
 * @param date - The date string or Date object to parse
 * @param format - Optional format string; ignored for Date objects
 * @returns A dayjs instance (may be invalid if parsing fails)
 * @example
 * ```ts
 * parseDate("2025-11-10") // dayjs instance
 * parseDate("2025-11-10 16:30:45") // dayjs instance
 * parseDate("20251110", "YYYYMMDD") // dayjs instance with custom format
 * parseDate("10/11/2025", "DD/MM/YYYY") // dayjs instance with custom format
 * parseDate(new Date()) // dayjs instance from Date object
 * ```
 */
export function parseDate(date: string | Date, format?: string): Dayjs {
  if (date instanceof Date) {
    return dayjs(date);
  }

  return format ? dayjs(date, format) : dayjs(date);
}

/**
 * Attempts to parse a date string by trying various datetime and date formats.
 * Returns null if parsing fails with all formats.
 *
 * @param date - The date string to parse
 * @returns A dayjs instance if parsing succeeds, null otherwise
 * @example
 * ```ts
 * tryParseDate("2025-11-10 16:30:45") // dayjs instance
 * tryParseDate("2025/11/10") // dayjs instance
 * tryParseDate("20251110") // dayjs instance
 * tryParseDate("invalid date") // null
 * ```
 */
export function tryParseDate(date: string): MaybeNull<Dayjs> {
  const allFormats = [...DATETIME_FORMATS, ...DATE_FORMATS];

  for (const format of allFormats) {
    const parsed = dayjs(date, format, true);

    if (parsed.isValid()) {
      return parsed;
    }
  }

  const defaultParsed = dayjs(date);
  return defaultParsed.isValid() ? defaultParsed : null;
}

/**
 * Attempts to parse a time string by trying various time, minute, and hour formats.
 * Returns null if parsing fails with all formats.
 *
 * Use this for inputs that represent a time-of-day rather than a full date —
 * dayjs's built-in parser rejects bare time strings like `"08:08:00"`, so the
 * generic `tryParseDate` cannot round-trip values from time-only pickers.
 *
 * @param time - The time string to parse
 * @returns A dayjs instance if parsing succeeds, null otherwise
 * @example
 * ```ts
 * tryParseTime("08:08:00") // dayjs instance
 * tryParseTime("08:08")    // dayjs instance
 * tryParseTime("0808")     // dayjs instance
 * tryParseTime("08")       // dayjs instance
 * tryParseTime("invalid")  // null
 * ```
 */
export function tryParseTime(time: string): MaybeNull<Dayjs> {
  const allFormats = [...TIME_FORMATS, ...MINUTE_FORMATS, ...HOUR_FORMATS];

  for (const format of allFormats) {
    const parsed = dayjs(time, format, true);

    if (parsed.isValid()) {
      return parsed;
    }
  }

  return null;
}

/**
 * Formats a dayjs instance with the specified format.
 *
 * @param date - The dayjs instance to format
 * @param format - The format string (defaults to "YYYY-MM-DD HH:mm:ss")
 * @returns The formatted date string
 * @example
 * ```ts
 * formatDate(dayjs()) // "2025-11-10 16:30:45"
 * formatDate(dayjs(), "YYYY-MM-DD") // "2025-11-10"
 * formatDate(dayjs(), "HH:mm:ss") // "16:30:45"
 * ```
 */
export function formatDate(date: Dayjs, format: string = DEFAULT_DATETIME_FORMAT): string {
  return date.format(format);
}

/**
 * Gets the current time as a dayjs instance.
 *
 * @returns The current time as a dayjs instance
 * @example
 * ```ts
 * const now = getNow() // dayjs instance
 * now.format("YYYY-MM-DD") // "2025-11-10"
 * ```
 */
export function getNow(): Dayjs {
  return dayjs();
}

/**
 * Gets the current date string in "YYYY-MM-DD" format.
 *
 * @returns The current date string
 * @example
 * ```ts
 * getNowDateString() // "2025-11-10"
 * ```
 */
export function getNowDateString(): string {
  return dayjs().format(DEFAULT_DATE_FORMAT);
}

/**
 * Gets the current time string in "HH:mm:ss" format.
 *
 * @returns The current time string
 * @example
 * ```ts
 * getNowTimeString() // "16:30:45"
 * ```
 */
export function getNowTimeString(): string {
  return dayjs().format(DEFAULT_TIME_FORMAT);
}

/**
 * Gets the current date time string in "YYYY-MM-DD HH:mm:ss" format.
 *
 * @returns The current date time string
 * @example
 * ```ts
 * getNowDateTimeString() // "2025-11-10 16:30:45"
 * ```
 */
export function getNowDateTimeString(): string {
  return dayjs().format(DEFAULT_DATETIME_FORMAT);
}

/**
 * Gets the current date time in a localized full format.
 *
 * @returns The localized date time string
 * @example
 * ```ts
 * // With zh-cn locale
 * getLocalizedDateTime() // "2025年11月10日星期日下午4点30分45秒"
 * getLocalizedDateTime(false) // "2025年11月10日星期日"
 * ```
 */
export function getLocalizedDateTime(includeTime = true): string {
  return dayjs().format(includeTime ? LOCALIZED_DATETIME_FORMAT : LOCALIZED_DATE_FORMAT);
}

const FORMAT_MAP = {
  year: YEAR_FORMATS,
  quarter: QUARTER_FORMATS,
  month: MONTH_FORMATS,
  week: WEEK_FORMATS,
  date: DATE_FORMATS,
  time: TIME_FORMATS,
  hour: HOUR_FORMATS,
  minute: MINUTE_FORMATS,
  datetime: DATETIME_FORMATS
} as const;

/**
 * Gets the available format patterns for a temporal picker mode.
 *
 * @param mode - The temporal picker mode
 * @returns An array of format strings for the specified mode
 * @example
 * ```ts
 * getTemporalFormats("date") // ["YYYY-MM-DD", "YYYY/MM/DD", ...]
 * getTemporalFormats("time") // ["HH:mm:ss", "HH.mm.ss", "HHmmss"]
 * getTemporalFormats("datetime") // ["YYYY-MM-DD HH:mm:ss", ...]
 * ```
 */
export function getTemporalFormats<const T extends TemporalMode>(mode: T): typeof FORMAT_MAP[T] {
  return FORMAT_MAP[mode];
}
