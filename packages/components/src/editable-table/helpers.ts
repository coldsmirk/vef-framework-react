import type { AnyObject, DeepKeys, Key } from "@vef-framework-react/shared";

import type { ErasedFieldOptions } from "../form/helpers";
import type { EditableColumn, EditableColumnOptions } from "./types";

/**
 * Type-safe factory for an {@link EditableColumn}. Splits the input into the
 * display/slot fields and the `<form.AppField>` options (validators, listeners,
 * …), erasing the latter into an opaque {@link ErasedFieldOptions} so a
 * heterogeneous `EditableColumn<TRow>[]` stays a single, well-typed array.
 * `restoreFieldOptions` (from the form module) reverses this at the render site.
 */
export function createEditableColumn<TRow extends AnyObject>(
  dataIndex: DeepKeys<TRow>,
  options: EditableColumnOptions<TRow> = {}
): EditableColumn<TRow> {
  const {
    align,
    className,
    editable,
    ellipsis,
    fixed,
    key,
    minWidth,
    renderEditor,
    renderView,
    title,
    width,
    ...fieldOptions
  } = options;

  const hasFieldOptions = Object.keys(fieldOptions).length > 0;

  return {
    align,
    className,
    dataIndex,
    editable,
    ellipsis,
    fieldOptions: hasFieldOptions ? (fieldOptions as unknown as ErasedFieldOptions<TRow>) : undefined,
    fixed,
    key: key ?? (dataIndex as Key),
    minWidth,
    renderEditor,
    renderView,
    title,
    width
  };
}
