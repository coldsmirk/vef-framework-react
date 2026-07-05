/**
 * Bytes conversion factor
 */
const BYTES_UNIT = 1024;

/**
 * Byte size unit names
 */
const BYTE_SIZES = ["B", "KB", "MB", "GB", "TB", "PB"];

/**
 * Number unit conversion factor
 */
const NUMBER_UNIT = 1000;

/**
 * Number unit names
 */
const NUMBER_UNITS = ["", "K", "M", "B", "T"];

/**
 * Cached logarithm values for performance
 */
const LOG_BYTES_UNIT = Math.log(BYTES_UNIT);
const LOG_NUMBER_UNIT = Math.log(NUMBER_UNIT);

/**
 * Format bytes to human readable string
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with unit (B, KB, MB, GB, TB, PB)
 * @example
 * ```ts
 * formatBytes(1024) // "1 KB"
 * formatBytes(1536, 1) // "1.5 KB"
 * formatBytes(1048576) // "1 MB"
 * formatBytes(0) // "0 B"
 * ```
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) {
    return "0 B";
  }

  const dm = Math.max(decimals, 0);
  const i = Math.floor(Math.log(bytes) / LOG_BYTES_UNIT);

  return `${Number((bytes / BYTES_UNIT ** i).toFixed(dm))} ${BYTE_SIZES[i]}`;
}

/**
 * Format large numbers to human readable string with units (K, M, B, T)
 *
 * @param num - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with unit (K, M, B, T)
 * @example
 * ```ts
 * formatNumber(1000) // "1 K"
 * formatNumber(1500, 1) // "1.5 K"
 * formatNumber(1234567) // "1.23 M"
 * formatNumber(999) // "999"
 * formatNumber(0) // "0"
 * ```
 */
export function formatNumber(num: number, decimals = 2): string {
  if (num === 0) {
    return "0";
  }

  if (num < NUMBER_UNIT) {
    return num.toString();
  }

  const dm = Math.max(decimals, 0);
  const i = Math.floor(Math.log(num) / LOG_NUMBER_UNIT);

  return `${Number((num / NUMBER_UNIT ** i).toFixed(dm))} ${NUMBER_UNITS[i]}`;
}
