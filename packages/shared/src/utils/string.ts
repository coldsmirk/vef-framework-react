import { snakeCase } from "./lib";

/**
 * Convert a string to constant case
 *
 * @param value - The value
 * @returns - The constant case string
 */
export function constantCase(value: string) {
  return snakeCase(value).toUpperCase();
}

/**
 * Convert an unknown value to string
 *
 * @param value - The value to stringify
 * @param emptyForNullish - Whether to return empty string for null/undefined (default: true)
 * @returns - The string representation
 */
export function stringify(value: unknown): string;

export function stringify(value: unknown, emptyForNullish = true): string {
  if (value === null) {
    return emptyForNullish ? "" : "null";
  }

  if (value === undefined) {
    return emptyForNullish ? "" : "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return value.toString();
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
