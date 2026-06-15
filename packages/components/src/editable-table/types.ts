import type { AnyObject, DeepKeys, Key } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { fieldComponents } from "../form/fields";
import type { CreateFieldFn, ErasedFieldOptions } from "../form/helpers";
import type { TableColumn } from "../table";

/**
 * Render context handed to a column's editor slot, carrying the row identity
 * so the slot can branch on the concrete record without re-deriving it.
 */
export interface EditFieldContext<TRow extends AnyObject> {
  row: TRow;
  index: number;
  rowKey: string;
}

/**
 * Read-only display slot. Renders the cell content while the row is not being
 * edited. Falls back to the raw value when omitted.
 */
export type RenderView<TRow extends AnyObject> = (value: unknown, row: TRow, index: number) => ReactNode;

/**
 * Editor slot. Renders a form control bound to the row's draft form while the
 * row is being edited. `field` is the injected field-component dictionary
 * (`field.Input`, `field.Select`, …), matching `createField`'s render shape.
 * The column is treated as read-only when omitted.
 */
export type RenderEditor<TRow extends AnyObject> = (
  field: typeof fieldComponents,
  context: EditFieldContext<TRow>
) => ReactNode;

/**
 * Display-only column properties forwarded verbatim to the underlying antd column.
 */
type EditableColumnDisplay<TRow extends AnyObject> = Pick<
  TableColumn<TRow>,
  "title" | "width" | "minWidth" | "align" | "fixed" | "ellipsis" | "className"
>;

/**
 * Column definition for {@link EditableTable}. Replaces antd's single `render`
 * with two slots: {@link RenderView} (read mode) and {@link RenderEditor} (edit
 * mode). Use {@link createEditableColumn} to attach type-safe validators.
 */
export interface EditableColumn<TRow extends AnyObject> extends EditableColumnDisplay<TRow> {
  /**
   * Data key of the column; doubles as the form field name while editing.
   */
  dataIndex: DeepKeys<TRow>;
  /**
   * Stable column identity; defaults to `dataIndex`.
   */
  key?: Key;
  /**
   * Whether this column participates in editing. Defaults to `true`.
   */
  editable?: boolean;
  /**
   * Read-only display slot; falls back to the raw value when omitted.
   */
  renderView?: RenderView<TRow>;
  /**
   * Editor slot; the column stays read-only when omitted.
   */
  renderEditor?: RenderEditor<TRow>;
  /**
   * Erased `<form.AppField>` options (validators, listeners…) from `createEditableColumn`.
   */
  fieldOptions?: ErasedFieldOptions<TRow>;
}

/**
 * Field-level options forwarded to `<form.AppField>` (validators, listeners,
 * defaultValue…), mirroring `createField`'s input minus its render slots.
 */
type EditableFieldOptions<TRow extends AnyObject> = Omit<Parameters<CreateFieldFn<TRow>>[1], "render" | "renderMeta">;

/**
 * Input accepted by {@link createEditableColumn}: field options plus display and slot fields.
 */
export type EditableColumnOptions<TRow extends AnyObject>
  = & EditableFieldOptions<TRow>
    & EditableColumnDisplay<TRow>
    & {
      key?: Key;
      editable?: boolean;
      renderView?: RenderView<TRow>;
      renderEditor?: RenderEditor<TRow>;
    };
