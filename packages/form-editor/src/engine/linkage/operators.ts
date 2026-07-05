import type { EvaluationContext, LinkageConditionLeaf, LinkageOperator } from "../../types";

import { isNullish } from "@vef-framework-react/shared";

import { exhaustive } from "../assert-never";
import { isRecord } from "../validation";

/**
 * The full set of supported leaf operators, in display order. Mirrors the
 * union `LinkageOperator` and is used both by the editor UI (to render the
 * operator dropdown) and the validator (to reject unknown operators in
 * externally-supplied schemas).
 */
export const LINKAGE_OPERATORS: readonly LinkageOperator[] = [
  "eq",
  "ne",
  "gt",
  "lt",
  "gte",
  "lte",
  "contains",
  "empty",
  "notEmpty"
];

/**
 * True when a value is considered "empty" for linkage purposes — covers
 * the typical user-facing notion of empty (nullish / `""` / `[]`). Numbers
 * (including `0`), booleans, and non-empty objects are NOT empty. An array
 * counts as empty when it holds no meaningful entry, so a date range cleared
 * to `["", ""]` is treated the same as an unset `[]` by `required` and the
 * `empty` / `notEmpty` operators.
 */
export function isEmptyRuntimeValue(value: unknown): boolean {
  if (isNullish(value)) {
    return true;
  }

  if (typeof value === "string") {
    return value.length === 0;
  }

  if (Array.isArray(value)) {
    return value.every(item => isEmptyRuntimeValue(item));
  }

  return false;
}

/**
 * Resolve a leaf's source to its runtime value. A plain key reads the form
 * values; a `$`-rooted path walks the evaluation context — `$user.departmentId`
 * reads `context.user.departmentId`, `$vars.quota` reads a variable, `$form.x`
 * is the explicit spelling of a form value. An unknown root or a broken path
 * resolves to `undefined` (which no positive operator matches), mirroring how
 * an absent form key behaves.
 */
function resolveLeafSourceValue(
  sourceKey: string,
  values: Record<string, unknown>,
  context: EvaluationContext | undefined
): unknown {
  if (!sourceKey.startsWith("$")) {
    return values[sourceKey];
  }

  const [root, ...path] = sourceKey.split(".");
  let value: unknown;

  switch (root) {
    case "$form": {
      value = values;
      break;
    }

    case "$vars": {
      value = context?.variables;
      break;
    }

    case "$user": {
      value = context?.user;
      break;
    }

    case "$node": {
      value = context?.node;
      break;
    }

    default: {
      return undefined;
    }
  }

  for (const segment of path) {
    if (!isRecord(value)) {
      return undefined;
    }

    value = value[segment];
  }

  return value;
}

/**
 * Evaluates a leaf condition against the current form values (or, for a
 * `$`-rooted source path, the evaluation context — see
 * {@link resolveLeafSourceValue}). Operators fall back to `false` rather than
 * throw when the source value is of an unexpected type, so a malformed
 * condition can never crash the renderer.
 */
export function matchLeaf(
  leaf: LinkageConditionLeaf,
  values: Record<string, unknown>,
  context?: EvaluationContext
): boolean {
  const sourceValue = resolveLeafSourceValue(leaf.sourceKey, values, context);
  const expectedValue = leaf.value;

  switch (leaf.operator) {
    case "eq": { return areComparableValuesEqual(sourceValue, expectedValue); }

    case "ne": { return !areComparableValuesEqual(sourceValue, expectedValue); }

    case "gt": { return compareNumbers(sourceValue, expectedValue, (l, r) => l > r); }

    case "lt": { return compareNumbers(sourceValue, expectedValue, (l, r) => l < r); }

    case "gte": { return compareNumbers(sourceValue, expectedValue, (l, r) => l >= r); }

    case "lte": { return compareNumbers(sourceValue, expectedValue, (l, r) => l <= r); }

    case "contains": { return containsValue(sourceValue, expectedValue); }

    case "empty": { return isEmptyRuntimeValue(sourceValue); }

    case "notEmpty": { return !isEmptyRuntimeValue(sourceValue); }

    default: {
      // An out-of-contract operator (unvalidated host schema) never matches —
      // the compile-time check keeps the switch exhaustive over the union.
      exhaustive(leaf.operator);
      return false;
    }
  }
}

/**
 * Loose equality for `eq` / `ne`: `Object.is` identity first (which also makes
 * `NaN` equal to itself), then string-coerced comparison for primitives so the
 * editor's string-typed condition values match numeric field values
 * (`"5"` eq `5`). An array or object source NEVER compares equal — there is no
 * meaningful single-value identity for them here, so `eq` is false and `ne` is
 * true; `contains` is the operator for array membership.
 */
function areComparableValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (isNullish(left) || isNullish(right)) {
    return false;
  }

  if (typeof left === "object" || typeof right === "object") {
    return false;
  }

  return String(left) === String(right);
}

function compareNumbers(
  left: unknown,
  right: unknown,
  predicate: (left: number, right: number) => boolean
): boolean {
  // An empty / unset operand must not coerce to 0 (`Number(null) === 0`,
  // `Number("") === 0`). On the source side that would make an empty field
  // satisfy `gte 0`; on the expected side an unfilled condition (`gt` with no
  // value) would behave as `gt 0`. Both fall back to no-match, mirroring
  // `containsValue`'s empty-expected guard so the empty-value contract stays
  // uniform across leaf operators.
  if (isEmptyRuntimeValue(left) || isEmptyRuntimeValue(right)) {
    return false;
  }

  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
    return false;
  }

  return predicate(leftNumber, rightNumber);
}

function containsValue(sourceValue: unknown, expectedValue: unknown): boolean {
  // A `contains` leaf with no configured value must not match everything
  // (`"anything".includes("")` is always true); treat empty expected as no match.
  if (isEmptyRuntimeValue(expectedValue)) {
    return false;
  }

  if (typeof sourceValue === "string") {
    return sourceValue.includes(String(expectedValue));
  }

  if (Array.isArray(sourceValue)) {
    return sourceValue.some(item => areComparableValuesEqual(item, expectedValue));
  }

  return false;
}
