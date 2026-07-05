import type { ColumnDataType, FormField, FormSchema, Validatable } from "../../types";

import { walkUniqueRootKeyedFields } from "../keys";

/**
 * A keyed field projected to its table-storage column shape: the dialect-
 * independent logical type plus the parameters the backend needs to render a
 * precise SQL type (VARCHAR(maxLength), DECIMAL(_, precision)). Structurally
 * feeds the backend's `FormFieldDefinition` columnType / maxLength / precision.
 */
export interface ColumnDefinition {
  key: string;
  columnType: ColumnDataType;
  maxLength?: number;
  precision?: number;
}

/**
 * Deterministic widget → column type. number (integer/decimal by precision) and
 * the string family (textfield / select / radio, sized by maxLength) are
 * resolved separately in {@link inferColumnType} since the widget alone does not
 * fix their type, so they are absent here. Multi-value widgets (checkbox-group /
 * daterange) project into a JSON column.
 */
const COLUMN_TYPE_BY_WIDGET: Record<string, ColumnDataType> = {
  switch: "boolean",
  date: "date",
  datetime: "datetime",
  "checkbox-group": "json",
  daterange: "json",
  textarea: "text",
  "code-editor": "text"
};

/**
 * Infer a keyed field's column type from its widget, honoring an explicit
 * `columnType` override first. Most widgets map deterministically; only the
 * value-ambiguous ones need the override: number is integer or decimal by its
 * `precision`, and select/radio default to string but can be pinned to integer
 * when their option values are numeric. Unknown / consumer-registered widgets
 * fall back to a lossless string/text column.
 */
export function inferColumnType(field: FormField): ColumnDataType {
  const override = (field as { columnType?: ColumnDataType }).columnType;

  if (override !== undefined) {
    return override;
  }

  if (field.type === "number") {
    const { precision } = field as { precision?: number };

    return precision !== undefined && precision > 0 ? "decimal" : "integer";
  }

  const mapped = COLUMN_TYPE_BY_WIDGET[field.type];

  if (mapped !== undefined) {
    return mapped;
  }

  // textfield / select / radio and any consumer-registered widget: a bounded
  // string maps to a sized column, an unbounded one to lossless text.
  const maxLength = (field as Validatable).validate?.maxLength;

  return maxLength !== undefined && maxLength > 0 ? "string" : "text";
}

/**
 * Project a form schema to its ordered table-storage column inventory — the same
 * root-scope keyed-leaf projection `toFormFieldDefinitions` uses (subform-scoped
 * fields and non-keyed presentation excluded), deduped by key across both device
 * presentations with pc winning a collision. Each entry carries the inferred (or
 * overridden) column type plus the maxLength / precision the backend needs.
 */
export function toColumnDefinitions(schema: FormSchema): ColumnDefinition[] {
  const definitions: ColumnDefinition[] = [];

  walkUniqueRootKeyedFields(schema, field => {
    const columnType = inferColumnType(field);
    const definition: ColumnDefinition = { key: field.key, columnType };

    const maxLength = (field as Validatable).validate?.maxLength;

    if (columnType === "string" && maxLength !== undefined && maxLength > 0) {
      definition.maxLength = maxLength;
    }

    const { precision } = field as { precision?: number };

    if (columnType === "decimal" && precision !== undefined && precision > 0) {
      definition.precision = precision;
    }

    definitions.push(definition);
  });

  return definitions;
}
