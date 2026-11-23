import type { AggregateKind, ConditionOperator, FieldKind, FormFieldDefinition } from "../types";

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: "等于",
  ne: "不等于",
  gt: "大于",
  gte: "大于等于",
  lt: "小于",
  lte: "小于等于",
  contains: "包含",
  not_contains: "不包含",
  starts_with: "开头是",
  ends_with: "结尾是",
  in: "属于",
  not_in: "不属于",
  is_empty: "为空",
  is_not_empty: "不为空"
};

export const NO_VALUE_OPERATORS: ConditionOperator[] = ["is_empty", "is_not_empty"];

export const MULTI_VALUE_OPERATORS: ConditionOperator[] = ["in", "not_in"];

export const AGGREGATE_LABELS: Record<AggregateKind, string> = {
  count: "行数",
  sum: "求和",
  avg: "平均值"
};

/**
 * Valid scalar condition operators per field kind (single-valued). Lockstep
 * twin of `fieldConditionOperators` in Go `approval/condition.go` — any change
 * here must land in both repos.
 */
const OPERATORS_BY_KIND: Record<FieldKind, readonly ConditionOperator[]> = {
  input: ["eq", "ne", "contains", "not_contains", "starts_with", "ends_with", "in", "not_in", "is_empty", "is_not_empty"],
  textarea: ["eq", "ne", "contains", "not_contains", "starts_with", "ends_with", "is_empty", "is_not_empty"],
  number: ["eq", "ne", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
  date: ["eq", "ne", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
  select: ["eq", "ne", "in", "not_in", "is_empty", "is_not_empty"],
  upload: ["is_empty", "is_not_empty"],
  // Table subjects always compare through an aggregate; the rule item
  // narrows the operator set to AGGREGATE_OPERATORS instead of this map.
  table: []
};

/**
 * Valid scalar condition operators for a multi-value selection field
 * (`kind === "select" && isMultiple === true`). Its runtime value is an array
 * of option values, so element membership (`contains` / `not_contains`)
 * replaces scalar equality / set membership (`eq` / `ne` / `in` / `not_in`).
 * Lockstep twin of `multiSelectConditionOperators` in Go
 * `approval/condition.go`.
 */
const MULTI_SELECT_OPERATORS: readonly ConditionOperator[] = [
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty"
];

/**
 * Condition operators valid for a scalar field condition targeting `field`
 * (by its `kind` and `isMultiple` shape). Lockstep twin of
 * `approval.ConditionOperatorsForField` in Go `approval/condition.go`.
 */
export function getOperatorsForField(field: Pick<FormFieldDefinition, "kind" | "isMultiple">): readonly ConditionOperator[] {
  if (field.kind === "select" && field.isMultiple) {
    return MULTI_SELECT_OPERATORS;
  }

  return OPERATORS_BY_KIND[field.kind] ?? [];
}

/**
 * Reports whether `operator` is valid for a scalar field condition targeting
 * `field`. Lockstep twin of `approval.IsOperatorValidForField` in Go
 * `approval/condition.go`.
 */
export function isOperatorValidForField(
  field: Pick<FormFieldDefinition, "kind" | "isMultiple">,
  operator: string
): boolean {
  return (getOperatorsForField(field) as readonly string[]).includes(operator);
}
