import type { ConditionOperator, FieldKind } from "../../types";

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

const OPERATORS_BY_KIND: Record<FieldKind, ConditionOperator[]> = {
  input: ["eq", "ne", "contains", "not_contains", "starts_with", "ends_with", "in", "not_in", "is_empty", "is_not_empty"],
  textarea: ["eq", "ne", "contains", "not_contains", "starts_with", "ends_with", "is_empty", "is_not_empty"],
  number: ["eq", "ne", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
  date: ["eq", "ne", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
  select: ["eq", "ne", "in", "not_in", "is_empty", "is_not_empty"],
  upload: ["is_empty", "is_not_empty"]
};

export function getOperatorsForFieldKind(kind: FieldKind): ConditionOperator[] {
  return OPERATORS_BY_KIND[kind] ?? [];
}
