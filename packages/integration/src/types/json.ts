/**
 * A JSON value — the type-safe shape of the arbitrary payloads contracts carry.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * A JSON object value.
 */
export type JsonObject = Record<string, JsonValue>;
