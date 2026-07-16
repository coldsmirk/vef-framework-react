import dayjs from "dayjs";

/**
 * Format a backend timestamp (`YYYY-MM-DD HH:mm:ss`) for display, or a dash
 * when empty.
 */
export function formatTimestamp(value?: string | null): string {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";
}

/**
 * Format a duration in seconds as a compact human-readable span (`3天2小时`,
 * `45分钟`). Sub-minute durations render as `<1分钟`.
 */
export function formatDurationSeconds(seconds: number): string {
  if (seconds < 0) {
    return "-";
  }

  if (seconds < 60) {
    return "<1分钟";
  }

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);

  if (days > 0) {
    return hours > 0 ? `${days}天${hours}小时` : `${days}天`;
  }

  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
  }

  return `${minutes}分钟`;
}
