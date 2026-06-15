import { isPlainObject } from "./lib";

/**
 * Normalize plain object by sorting keys and handling symbols.
 */
function normalizeObject(value: Record<keyof any, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const stringKeys = Object.keys(value).toSorted();
  const symbolKeys = Object.getOwnPropertySymbols(value);

  for (const key of stringKeys) {
    result[key] = value[key];
  }

  const sortedSymbols = symbolKeys
    .map(sym => { return { key: sym.toString(), value: value[sym] }; })
    .toSorted((a, b) => a.key.localeCompare(b.key));

  for (const { key, value: symbolValue } of sortedSymbols) {
    result[`@@${key}`] = symbolValue;
  }

  return result;
}

/**
 * Generate a stable hash key from any value by serializing to JSON.
 * Objects are normalized with sorted keys for consistent hashing.
 */
export function hashKey(key: unknown): string {
  return JSON.stringify(key, (_, value) => {
    if (isPlainObject(value)) {
      return normalizeObject(value as never);
    }

    return value;
  });
}
