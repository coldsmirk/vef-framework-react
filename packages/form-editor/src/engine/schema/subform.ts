import type { DynamicSubformRows, FieldOption, FixedSubformRows, FormDataSource, SubformNode } from "../../types";

import { isRecord } from "../validation";

/**
 * Default row key storing the snapshotted `{ value, label }` header cell on a
 * fixed-row (matrix/checklist) subform.
 */
export const DEFAULT_FIXED_ITEM_KEY = "item";

/**
 * Default column title for the read-only row-header column of a fixed-row
 * subform.
 */
export const DEFAULT_FIXED_HEADER_LABEL = "自查内容";

/**
 * Default label for a dynamic subform's add-row button.
 */
export const DEFAULT_DYNAMIC_ADD_LABEL = "新增一行";

const EMPTY_DYNAMIC_ROWS: DynamicSubformRows = Object.freeze({ mode: "dynamic" });

/**
 * Narrow a subform to its fixed-row mode. Omitted `rows` is always dynamic.
 */
export function isFixedSubform(subform: SubformNode): subform is SubformNode & { rows: FixedSubformRows } {
  return subform.rows?.mode === "fixed";
}

/**
 * Read the dynamic-row configuration of a subform, falling back to an empty
 * `{ mode: "dynamic" }` descriptor when `rows` is omitted or fixed.
 */
export function getDynamicSubformRows(subform: SubformNode): DynamicSubformRows {
  return subform.rows?.mode === "dynamic" ? subform.rows : EMPTY_DYNAMIC_ROWS;
}

/**
 * Whether a candidate item value is a valid non-empty scalar (`string` with
 * non-whitespace text, or finite `number`). Mirrors the Go backend's
 * `formatFixedRowItemValue` check.
 */
export function isValidFixedItemValue(value: unknown): value is string | number {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Return the stringified option values that appear more than once in `options`.
 * Shared by schema validation, approval projection, and `OptionListEditor`.
 */
export function findDuplicateOptionValues(options: ReadonlyArray<{ value: unknown }>): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();

  for (const option of options) {
    const value = String(option.value);

    if (seen.has(value)) {
      duplicated.add(value);
    }

    seen.add(value);
  }

  return [...duplicated];
}

/**
 * Extract the snapshotted `{ value, label }` item cell from a fixed-row record,
 * or `undefined` if the cell is missing or malformed.
 */
export function readFixedRowItem(row: unknown, itemKey: string): FieldOption | undefined {
  if (!isRecord(row) || itemKey.length === 0) {
    return undefined;
  }

  const cell = row[itemKey];

  if (!isRecord(cell) || !isValidFixedItemValue(cell.value) || typeof cell.label !== "string") {
    return undefined;
  }

  return {
    value: cell.value,
    label: cell.label
  };
}

/**
 * Display label of a fixed row's header cell, falling back to an empty string
 * when absent.
 */
export function fixedRowItemLabel(row: unknown, itemKey: string): string {
  return readFixedRowItem(row, itemKey)?.label ?? "";
}

/**
 * Synchronously resolve a fixed-row subform's static items (inline `static`, or
 * `ref` pointing at a form-global `static` data source). Returns `undefined`
 * for async sources (`codeSet`, `remote`, `ref`-to-`remote`, or dangling `ref`).
 */
export function resolveStaticFixedRowItems(
  rows: FixedSubformRows,
  dataSources: readonly FormDataSource[] | undefined
): FieldOption[] | undefined {
  const { source } = rows;

  if (source.kind === "static") {
    return source.options;
  }

  if (source.kind === "ref") {
    const found = dataSources?.find(candidate => candidate.id === source.dataSourceId);

    if (found?.kind === "static") {
      return found.options;
    }
  }

  return undefined;
}
