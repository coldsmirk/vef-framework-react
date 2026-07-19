/**
 * A JSON value and the object form used for a schedule's opaque `params`
 * payload — carried verbatim to the job handler on the Go side.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;
