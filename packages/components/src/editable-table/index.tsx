import type { AnyObject } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { EditableTableProps } from "./props";

import { get, isFunction, stringify } from "@vef-framework-react/shared";
import { useMemo } from "react";

import { useForm } from "../form";
import { Stack } from "../stack";
import { Table } from "../table";
import { AddRowButton } from "./components";
import { useEditableActions, useEditableColumns } from "./hooks";
import { EditableTableStoreProvider } from "./store";

function makeGetKey<TRow extends AnyObject>(rowKey: EditableTableProps<TRow>["rowKey"]): (row: TRow) => string {
  if (isFunction(rowKey)) {
    return row => stringify(rowKey(row));
  }

  const field = (rowKey ?? "key") as string;
  return row => stringify(get(row, field));
}

function toPredicate<TRow extends AnyObject>(
  value: boolean | ((row: TRow) => boolean) | undefined,
  fallback: boolean
): (row: TRow) => boolean {
  if (isFunction(value)) {
    return value;
  }

  const resolved = value ?? fallback;
  return () => resolved;
}

function EditableTableInner<TRow extends AnyObject>({
  value,
  onChange,
  columns,
  rowKey,
  canEdit,
  canDelete,
  creatable,
  createRecord,
  renderRowActions,
  operationColumn,
  size,
  pagination,
  locale
}: EditableTableProps<TRow>): ReactNode {
  const form = useForm({ defaultValues: {} as TRow });

  const getKey = useMemo(() => makeGetKey<TRow>(rowKey), [rowKey]);
  const rowKeyField = isFunction(rowKey) ? null : ((rowKey ?? "key") as string);

  const editablePredicate = useMemo(() => toPredicate(canEdit, true), [canEdit]);
  const deletablePredicate = useMemo(() => toPredicate(canDelete, false), [canDelete]);

  const operation = useMemo(
    () => {
      return {
        deletable: deletablePredicate,
        editable: editablePredicate,
        enabled: true,
        extra: renderRowActions,
        texts: operationColumn?.texts,
        title: operationColumn?.title,
        width: operationColumn?.width
      };
    },
    [deletablePredicate, editablePredicate, operationColumn, renderRowActions]
  );

  const tableColumns = useEditableColumns(columns, getKey, operation);

  useEditableActions({
    createRecord,
    form,
    getKey,
    onChange,
    rowKeyField,
    value
  });

  return (
    <form.AppForm>
      <Stack gap="small">
        <Table<TRow>
          columns={tableColumns}
          dataSource={value}
          locale={locale}
          pagination={pagination ?? false}
          rowKey={getKey}
          size={size}
        />

        {creatable ? <AddRowButton /> : null}
      </Stack>
    </form.AppForm>
  );
}

/**
 * Controlled, inline-editable table. One row edits at a time; editing, adding
 * and deleting rows are operations on the controlled `value` array surfaced
 * through `onChange`. Built on the base `Table` and the form module — no
 * query / mutation involved.
 */
export function EditableTable<TRow extends AnyObject>(props: EditableTableProps<TRow>): ReactNode {
  return (
    <EditableTableStoreProvider>
      <EditableTableInner {...props} />
    </EditableTableStoreProvider>
  );
}

export type { EditableRowActionsTexts } from "./components";
export { createEditableColumn } from "./helpers";
export type { EditableOperationColumnConfig, EditableTableProps } from "./props";
export type * from "./types";
