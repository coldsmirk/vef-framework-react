import type { AnyObject, Awaitable } from "@vef-framework-react/shared";
import type { FC, ReactNode, Ref } from "react";

import type { PropsWithRef } from "../_base";
import type { ProTableProps } from "./props";
import type { ColumnSettingsProp, ProTableRef } from "./types";

import { css } from "@emotion/react";
import { memo } from "react";

import { Stack } from "../stack";
import { NonPaginatedTable, PaginatedTable, ProTableRefHolder } from "./components";
import { ColumnSettingsStorageKeyProvider } from "./context";
import { useColumnSettingsPersistence } from "./hooks";
import { ProTableStoreProvider } from "./store";

const containerStyle = css({
  height: "100%"
});

const defaultColumnSettings: ColumnSettingsProp = {};

interface ProTableContentProps {
  columnSettings: ColumnSettingsProp;
  children: ReactNode;
}

function ProTableContent({ columnSettings, children }: ProTableContentProps) {
  const storageKey = columnSettings === false ? undefined : columnSettings.storageKey;
  useColumnSettingsPersistence(storageKey);

  return (
    <ColumnSettingsStorageKeyProvider value={storageKey}>
      {children}
    </ColumnSettingsStorageKeyProvider>
  );
}

export const ProTable = memo(<TRow extends AnyObject, TParams extends AnyObject>({
  className,
  style,
  size,
  columns,
  columnSettings = defaultColumnSettings,
  rowKey,
  rowSelection,
  queryEnabled,
  queryParams,
  showSequenceColumn,
  operationColumn,
  selectedRowKeys,
  striped,
  virtual,
  ref,
  header,
  footer,
  onRowClick,
  onSelectedRowKeysChange,
  ...restProps
}: PropsWithRef<ProTableRef, ProTableProps<TRow, TParams>>) => {
  const tableProps = {
    className,
    columns,
    columnSettings,
    operationColumn,
    queryEnabled,
    queryParams,
    rowKey,
    rowSelection,
    selectedRowKeys,
    showSequenceColumn,
    size,
    striped,
    style,
    virtual,
    onRowClick,
    onSelectedRowKeysChange
  };

  return (
    <ProTableStoreProvider>
      <ProTableRefHolder ref={ref} />

      <ProTableContent columnSettings={columnSettings}>
        <Stack css={containerStyle} gap="medium">
          {header}

          {restProps.isPaginated === false
            ? <NonPaginatedTable {...tableProps} queryFn={restProps.queryFn} />
            : <PaginatedTable {...tableProps} queryFn={restProps.queryFn} />}

          {footer}
        </Stack>
      </ProTableContent>
    </ProTableStoreProvider>
  );
}) as (<TRow extends AnyObject, TParams extends AnyObject>(
  props: ProTableProps<TRow, TParams> & { ref?: Ref<ProTableRef> }
) => Awaitable<ReactNode>) & Pick<FC, "displayName">;

ProTable.displayName = "ProTable";

export {
  getRowKeyFn,
  OperationButtonGroup,
  TableSubscriber as ProTableSubscriber,
  type OperationButtonGroupProps,
  type TableSubscriberProps as ProTableSubscriberProps
} from "./components";
export type { ProTableProps } from "./props";
export type { ProTableState } from "./store";
export type {
  ColumnSettingsConfig,
  ColumnSettingsProp,
  OperationColumnConfig,
  ParamsWithPagination,
  ParamsWithSort,
  ProTableRef,
  RowSelectionConfig
} from "./types";
