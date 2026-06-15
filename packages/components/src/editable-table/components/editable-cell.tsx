import type { AnyObject } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { EditableColumn } from "../types";

import { useFormContext } from "../../form";
import { restoreFieldOptions } from "../../form/helpers";
import { useEditableTableStore } from "../store";

interface EditableCellProps<TRow extends AnyObject> {
  column: EditableColumn<TRow>;
  row: TRow;
  index: number;
  value: unknown;
  rowKey: string;
}

/**
 * Cell body for an editable column. Subscribes to `editingKey` via a boolean
 * selector so only the cells whose editing state flips re-render — this is what
 * lets the read ↔ edit toggle bypass the antd cell memo without re-rendering
 * the whole table.
 */
export function EditableCell<TRow extends AnyObject>({
  column,
  row,
  index,
  value,
  rowKey
}: EditableCellProps<TRow>): ReactNode {
  const editing = useEditableTableStore(state => state.editingKey === rowKey);

  if (!editing || column.editable === false || !column.renderEditor) {
    return column.renderView ? column.renderView(value, row, index) : ((value as ReactNode) ?? null);
  }

  return <EditableCellField column={column} index={index} row={row} rowKey={rowKey} />;
}

/**
 * Editing branch, split out so `useFormContext` is only called when the cell is
 * actually editing (keeping the read path free of form work). The editor is
 * expected to render with `noWrapper` so the inline control stays compact (no
 * label, no inline error that would inflate the row height); validation
 * feedback surfaces via a message on save instead.
 */
function EditableCellField<TRow extends AnyObject>({
  column,
  row,
  index,
  rowKey
}: Omit<EditableCellProps<TRow>, "value">): ReactNode {
  const form = useFormContext<TRow>();

  return (
    <form.AppField name={column.dataIndex} {...restoreFieldOptions(column.fieldOptions)}>
      {field => column.renderEditor!(field, {
        index,
        row,
        rowKey
      })}
    </form.AppField>
  );
}
