/**
 * A value the schema carries either verbatim or as an expression evaluated at
 * runtime against the current form values and evaluation context.
 *
 * One declaration serves every place the designer offers a "fixed value or
 * bound value" choice — linkage action values and remote data-source request
 * parameters — so the two cannot drift into different shapes and the editor
 * reuses one control for both.
 */
export type DynamicValue
  = | { kind: "literal"; value: unknown }
    | { kind: "expression"; source: string };

/**
 * Narrow an unknown to a {@link DynamicValue}. Used when reading values that
 * crossed a serialization boundary (an imported schema).
 */
export function isDynamicValue(value: unknown): value is DynamicValue {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DynamicValue>;

  return candidate.kind === "literal"
    || (candidate.kind === "expression" && typeof (candidate as { source?: unknown }).source === "string");
}
