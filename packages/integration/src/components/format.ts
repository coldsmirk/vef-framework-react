import dayjs from "dayjs";

/**
 * Format an ISO timestamp for a table cell, or a dash when empty.
 */
export function formatTimestamp(value?: string | null): string {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";
}
