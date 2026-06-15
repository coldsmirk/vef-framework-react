import type { AnyObject, Key } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { Length } from "../../_base";
import type { TableColumn } from "../../table";
import type { EditableRowActionsTexts } from "../components";
import type { EditableColumn } from "../types";

import { useMemo } from "react";

import { EditableCell, EditableRowActions } from "../components";

/**
 * Operation-column configuration resolved by EditableTable.
 */
export interface EditableOperationConfig<TRow extends AnyObject> {
  enabled: boolean;
  title?: ReactNode;
  width?: Length;
  texts?: EditableRowActionsTexts;
  editable: (row: TRow) => boolean;
  deletable: (row: TRow) => boolean;
  extra?: (row: TRow, index: number) => ReactNode;
}

/**
 * Compile `EditableColumn<TRow>[]` into antd columns. Each data column's render
 * returns a store-subscribed `<EditableCell>`; an operation column with the row
 * actions is appended when enabled. Memoized on stable inputs (never on
 * `editingKey`) so the column array reference stays stable across edit toggles.
 */
export function useEditableColumns<TRow extends AnyObject>(
  columns: Array<EditableColumn<TRow>>,
  getKey: (row: TRow) => string,
  operation: EditableOperationConfig<TRow>
): Array<TableColumn<TRow>> {
  return useMemo(() => {
    const compiled: Array<TableColumn<TRow>> = columns.map(column => {
      return {
        align: column.align,
        className: column.className,
        dataIndex: column.dataIndex as TableColumn<TRow>["dataIndex"],
        ellipsis: column.ellipsis,
        fixed: column.fixed,
        key: column.key ?? (column.dataIndex as Key),
        minWidth: column.minWidth,
        title: column.title,
        width: column.width,
        render: (value: unknown, row: TRow, index: number): ReactNode => <EditableCell column={column} index={index} row={row} rowKey={getKey(row)} value={value} />

      };
    });

    if (operation.enabled) {
      compiled.push({
        align: "center",
        key: "__editable_operations",
        title: operation.title ?? "操作",
        width: operation.width,
        render: (_value: unknown, row: TRow, index: number): ReactNode => (
          <EditableRowActions
            deletable={operation.deletable(row)}
            editable={operation.editable(row)}
            extra={operation.extra}
            index={index}
            row={row}
            rowKey={getKey(row)}
            texts={operation.texts}
          />
        )
      });
    }

    return compiled;
  }, [columns, getKey, operation]);
}
