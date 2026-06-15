import type { ExpressionContext, ExpressionEngine } from "../engine/loader";
import type {
  BranchSelection,
  ConditionBranchInput,
  ConditionGroupInput,
  ConditionInput,
  ConditionOperator
} from "./types";

import { isArray, isNullish, isString } from "@vef-framework-react/shared";

import { ExpressionError } from "../engine/errors";
import { loadEngine } from "../engine/loader";

/**
 * A subject must be a plain identifier path (`amount`, `user.age`, `items[0]`).
 * It is emitted verbatim into ZEN source, so anything else is rejected to keep
 * the condition compiler from being an expression-injection sink.
 */
const SUBJECT_PATTERN = /^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*|\[\d+\])*$/i;

/**
 * Serialize a JavaScript value into a ZEN literal. Nullish becomes `null`;
 * numbers / booleans / bigints are emitted verbatim; strings are quoted via
 * {@link encodeZenString}; arrays become `[a, b, ...]`.
 *
 * Throws {@link ExpressionError} for a value with no faithful ZEN
 * representation — an object, symbol, or function, or a string containing both
 * quote styles. Callers that need a sentinel instead of a throw go through
 * {@link compileCondition}, which degrades such a value to a non-compiling
 * (null) condition.
 */
export function toZenLiteral(value: unknown): string {
  if (isNullish(value)) {
    return "null";
  }

  // typeof (not isNumber) so NaN / Infinity stay valid ZEN number tokens.
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (isString(value)) {
    return encodeZenString(value);
  }

  if (isArray(value)) {
    return `[${value.map(item => toZenLiteral(item)).join(", ")}]`;
  }

  throw new ExpressionError(`Value of type "${typeof value}" has no ZEN literal representation`);
}

/**
 * Encode a string as a ZEN literal. ZEN string literals are **raw** between
 * matching quotes and honor no backslash escapes (`'a\nb'` is the four
 * characters `a \ n b`), so the encoder must not escape — it picks a delimiter
 * the value does not contain. A value containing both quote styles cannot be
 * represented as a raw ZEN literal and throws.
 */
function encodeZenString(value: string): string {
  const hasSingle = value.includes("'");
  const hasDouble = value.includes("\"");

  if (hasSingle && hasDouble) {
    throw new ExpressionError("String contains both single and double quotes and has no ZEN literal representation");
  }

  return hasSingle ? `"${value}"` : `'${value}'`;
}

function toArrayLiteral(value: unknown): string {
  return isArray(value) ? toZenLiteral(value) : `[${toZenLiteral(value)}]`;
}

/**
 * Emit the ZEN emptiness test matching the backend field evaluator's
 * `isEmptyValue`: null, blank (whitespace-only) text, and empty arrays are
 * empty; numbers and booleans never are. ZEN's `or` short-circuits, so the
 * type-guarded branches never evaluate against a null subject. The backend
 * additionally treats an empty map as empty for totality, but form values —
 * the only subjects this compiler targets — are never objects, and ZEN's
 * `len()` does not accept one.
 */
function zenIsEmpty(subject: string): string {
  return `(${subject} == null`
    + ` or (type(${subject}) == 'string' and len(trim(${subject})) == 0)`
    + ` or (type(${subject}) == 'array' and len(${subject}) == 0))`;
}

function compileFieldCondition(subject: string, operator: ConditionOperator, value: unknown): string {
  switch (operator) {
    case "eq": {
      return `${subject} == ${toZenLiteral(value)}`;
    }

    case "ne": {
      return `${subject} != ${toZenLiteral(value)}`;
    }

    case "gt": {
      return `${subject} > ${toZenLiteral(value)}`;
    }

    case "gte": {
      return `${subject} >= ${toZenLiteral(value)}`;
    }

    case "lt": {
      return `${subject} < ${toZenLiteral(value)}`;
    }

    case "lte": {
      return `${subject} <= ${toZenLiteral(value)}`;
    }

    case "contains": {
      return `contains(${subject}, ${toZenLiteral(value)})`;
    }

    case "not_contains": {
      return `not contains(${subject}, ${toZenLiteral(value)})`;
    }

    case "starts_with": {
      return `startsWith(${subject}, ${toZenLiteral(value)})`;
    }

    case "ends_with": {
      return `endsWith(${subject}, ${toZenLiteral(value)})`;
    }

    case "in": {
      return `${subject} in ${toArrayLiteral(value)}`;
    }

    case "not_in": {
      return `not (${subject} in ${toArrayLiteral(value)})`;
    }

    case "is_empty": {
      return zenIsEmpty(subject);
    }

    case "is_not_empty": {
      return `not ${zenIsEmpty(subject)}`;
    }

    default: {
      // Exhaustiveness guard: adding a ConditionOperator without a case here is a
      // compile error. The throw only covers runtime-invalid data forced past the
      // type with a cast, and is caught by compileCondition.
      operator satisfies never;
      throw new ExpressionError(`Unsupported operator: ${String(operator)}`);
    }
  }
}

/**
 * Compile a single condition into a ZEN boolean expression. Field conditions map
 * their operator to ZEN; expression conditions pass through verbatim. Returns
 * `null` when the condition is empty, its subject is not an identifier path, or
 * its value has no ZEN representation.
 */
export function compileCondition(condition: ConditionInput): string | null {
  if (condition.kind === "expression") {
    const expression = condition.expression.trim();
    return expression === "" ? null : expression;
  }

  const subject = condition.subject.trim();

  if (!SUBJECT_PATTERN.test(subject)) {
    return null;
  }

  try {
    return compileFieldCondition(subject, condition.operator, condition.value);
  } catch {
    // A value with no ZEN representation (object value, both-quote string) or a
    // cast-in invalid operator makes the condition uncompilable; degrade it to
    // null like an invalid subject so the group simply drops it.
    return null;
  }
}

/**
 * Compile a condition group (its conditions joined with AND). Returns `null`
 * when the group has no compilable conditions.
 */
export function compileGroup(group: ConditionGroupInput): string | null {
  const parts = group.conditions
    .map(condition => compileCondition(condition))
    .filter(part => part !== null);

  return parts.length === 0 ? null : parts.join(" and ");
}

/**
 * Compile a branch's condition groups into a single ZEN expression (groups
 * joined with OR). Returns `null` when the branch has no compilable groups
 * (e.g. a default branch).
 */
export function compileBranch(branch: ConditionBranchInput): string | null {
  const groups = (branch.conditionGroups ?? [])
    .map(group => compileGroup(group))
    .filter(group => group !== null);

  return groups.length === 0 ? null : groups.map(group => `(${group})`).join(" or ");
}

/**
 * Pick the matching branch for the given context using a pre-loaded engine.
 * Non-default branches are tested in ascending `priority` order; the first whose
 * compiled expression evaluates to `true` wins. Falls back to the default
 * branch, or a `null` id when neither matches.
 *
 * A branch whose expression throws for the given context (e.g. ZEN's `>`
 * throws when the subject is missing or non-numeric) is treated as not matching
 * rather than propagating — so a missing field degrades to the default branch
 * instead of crashing the caller.
 */
export function selectBranchWith(
  branches: ConditionBranchInput[],
  context: ExpressionContext,
  engine: Pick<ExpressionEngine, "evaluate" | "validate">
): BranchSelection {
  const ordered = branches.toSorted((a, b) => a.priority - b.priority);

  for (const branch of ordered) {
    if (branch.isDefault) {
      continue;
    }

    const expression = compileBranch(branch);

    if (expression === null) {
      continue;
    }

    if (evaluatesTrue(engine, expression, context)) {
      return { branchId: branch.id, matched: true };
    }
  }

  const fallback = ordered.find(branch => branch.isDefault);
  return { branchId: fallback?.id ?? null, matched: false };
}

function evaluatesTrue(
  engine: Pick<ExpressionEngine, "evaluate" | "validate">,
  expression: string,
  context: ExpressionContext
): boolean {
  try {
    return engine.evaluate(expression, context) === true;
  } catch (error) {
    if (import.meta.env.DEV) {
      reportEvaluationFailure(engine, expression, error);
    }

    return false;
  }
}

function reportEvaluationFailure(
  engine: Pick<ExpressionEngine, "validate">,
  expression: string,
  error: unknown
): void {
  // A compiled branch expression that fails to PARSE signals a bug in this
  // package's own emitter, not a runtime type mismatch (ZEN's `>` on a missing
  // field, the intended degrade-to-default path). validate() returns null for a
  // parsable expression and a diagnostic object otherwise, so surface only the
  // former — a real authoring/emitter bug should not hide behind the fallback.
  let diagnostic: unknown;

  try {
    diagnostic = engine.validate(expression);
  } catch {
    return;
  }

  if (!isNullish(diagnostic)) {
    console.warn(`[expression] compiled branch expression failed to parse: ${expression}`, diagnostic, error);
  }
}

/**
 * Pick the matching branch for the given context, loading the ZEN engine on
 * first use. See {@link selectBranchWith} for the selection semantics.
 */
export async function selectBranch(
  branches: ConditionBranchInput[],
  context: ExpressionContext
): Promise<BranchSelection> {
  const engine = await loadEngine();
  return selectBranchWith(branches, context, engine);
}
