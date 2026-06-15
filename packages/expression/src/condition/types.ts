/**
 * Structural shapes for the visual condition model compiled to ZEN. They mirror
 * the condition types used in the form and flow editors so a host can map those
 * definitions to {@link compileCondition} / {@link selectBranch} without this
 * package depending on either editor. The editors keep a flat working model for
 * form ergonomics (a row can hold both a half-typed field triple and an
 * expression while the author toggles between them); this discriminated input is
 * the narrowed, compiler-facing shape where each kind carries only what it uses.
 */

/**
 * The closed operator vocabulary understood by {@link compileCondition}, as a
 * runtime constant so validators can build allow-lists from it instead of
 * re-declaring the set. The {@link ConditionOperator} type derives from this
 * array — one definition site for both the type and the runtime list.
 */
export const CONDITION_OPERATORS = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "in",
  "not_in",
  "is_empty",
  "is_not_empty"
] as const;

/**
 * Operators understood by {@link compileCondition}. The compiler maps each to a
 * ZEN expression; this closed set is the single source of truth for the operator
 * vocabulary (the flow editor shares it instead of re-declaring its own).
 */
export type ConditionOperator = typeof CONDITION_OPERATORS[number];

/**
 * A field/operator/value condition.
 */
export interface FieldConditionInput {
  kind: "field";
  /**
   * The field path the operator tests. Emitted **verbatim** into the compiled
   * ZEN source as a path expression (guarded by an identifier-path pattern),
   * unlike `value`, which is serialized to a ZEN literal — so callers must supply
   * a valid identifier path, not arbitrary user text.
   */
  subject: string;
  operator: ConditionOperator;
  value: unknown;
}

/**
 * A raw ZEN expression condition, passed through to the engine verbatim.
 */
export interface ExpressionConditionInput {
  kind: "expression";
  expression: string;
}

/**
 * A single condition: either a field/operator/value triple or a raw expression.
 */
export type ConditionInput = FieldConditionInput | ExpressionConditionInput;

/**
 * A group of conditions, combined with AND.
 */
export interface ConditionGroupInput {
  conditions: ConditionInput[];
}

/**
 * A branch guarded by one or more condition groups (combined with OR).
 */
export interface ConditionBranchInput {
  id: string;
  priority: number;
  isDefault?: boolean;
  conditionGroups?: ConditionGroupInput[];
}

/**
 * The branch chosen by {@link selectBranch}. `matched` is true only when a
 * non-default branch's expression evaluated true (then `branchId` is that
 * branch's id). On the default-branch fallback `matched` is false while
 * `branchId` is the default's id; `branchId` is null only when nothing matched
 * and there is no default branch.
 */
export type BranchSelection
  = | { matched: true; branchId: string }
    | { matched: false; branchId: string | null };
