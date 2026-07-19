import dayjs from "dayjs";

/**
 * Format a naive local wall-clock timestamp for a table cell, or a dash when
 * empty. Backend values already arrive as `YYYY-MM-DD HH:mm:ss`.
 */
export function formatTimestamp(value?: string | null): string {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-";
}

/**
 * Humanize a run duration in milliseconds: sub-second stays as `ms`, under a
 * minute becomes `s`, longer becomes `min`. A missing/zero duration is a dash.
 */
export function formatDuration(ms?: number | null): string {
  if (ms === undefined || ms === null || ms <= 0) {
    return "-";
  }

  if (ms < 1000) {
    return `${ms} ms`;
  }

  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)} s`;
  }

  return `${(ms / 60_000).toFixed(1)} min`;
}
