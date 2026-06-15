import type { FieldGroup } from "../../types";

/**
 * Display label for each palette category. Sourced from the prototype
 * design's monochromatic Chinese-first wording.
 */
export const FIELD_GROUP_LABELS: Record<FieldGroup, string> = {
  "basic-input": "基础输入",
  selection: "选择项",
  "date-file": "日期 & 文件",
  container: "容器布局",
  action: "操作",
  presentation: "展示"
};

/**
 * Display order in the palette. Categories absent from the registry are
 * filtered out by the panel — adding a new field that targets a previously
 * empty group makes that group appear automatically.
 */
export const FIELD_GROUP_ORDER: readonly FieldGroup[] = [
  "basic-input",
  "selection",
  "date-file",
  "container",
  "action",
  "presentation"
];
