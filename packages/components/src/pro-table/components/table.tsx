import type { QueryKey } from "@vef-framework-react/core";
import type { AnyObject, Key } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { TableProps } from "../../table";
import type { NonPaginatedProTableProps, PaginatedProTableProps } from "../props";
import type { ColumnSettingsProp, ParamsWithPagination, ParamsWithSort } from "../types";

import { css } from "@emotion/react";
import { useQuery, useShallow } from "@vef-framework-react/core";
import { useEmitterEvent } from "@vef-framework-react/hooks";
import {
  get,
  isFunction,
  stringify
} from "@vef-framework-react/shared";
import { useEffect } from "react";

import { SYMBOL_PAGINATION, SYMBOL_SORT } from "../../_base/constants";
import { Table, usePaginationProps } from "../../table";
import { OPERATION_CELL_CLASS, useRowSelection, useTableColumns } from "../hooks";
import { useProTableStore } from "../store";
import { TableSummary } from "./table-summary";
import { TableTitle } from "./table-title";

type PaginatedTableProps<TRow extends AnyObject, TParams extends AnyObject> = Pick<
  PaginatedProTableProps<TRow, TParams>,
  | "className"
  | "style"
  | "size"
  | "queryFn"
  | "queryEnabled"
  | "queryParams"
  | "columns"
  | "rowKey"
  | "rowSelection"
  | "showSequenceColumn"
  | "operationColumn"
  | "selectedRowKeys"
  | "striped"
  | "virtual"
  | "title"
  | "summary"
  | "onRowClick"
  | "onSelectedRowKeysChange"
> & {
  columnSettings: ColumnSettingsProp;
};

type NonPaginatedTableProps<TRow extends AnyObject, TParams extends AnyObject> = Pick<
  NonPaginatedProTableProps<TRow, TParams>,
  | "className"
  | "style"
  | "size"
  | "queryFn"
  | "queryEnabled"
  | "queryParams"
  | "columns"
  | "rowKey"
  | "rowSelection"
  | "showSequenceColumn"
  | "operationColumn"
  | "selectedRowKeys"
  | "striped"
  | "virtual"
  | "title"
  | "summary"
  | "onRowClick"
  | "onSelectedRowKeysChange"
> & {
  columnSettings: ColumnSettingsProp;
};

// The antd class prefix is "vef-", set by the framework's ConfigProvider.
const clickableRowStyle = css({
  ".vef-table-tbody .vef-table-row": {
    cursor: "pointer"
  }
});

function buildOnRow<TRow extends AnyObject>(
  onRowClick: PaginatedTableProps<TRow, never>["onRowClick"]
): TableProps<TRow>["onRow"] {
  if (!onRowClick) {
    return undefined;
  }

  return (row, index) => {
    return {
      onClick(event) {
        // The operation column hosts per-row actions; a click there must not
        // also fire the row-level action. Guarding via closest() instead of
        // stopPropagation keeps outside-click behaviors (popovers, dropdowns)
        // working.
        if (event.target instanceof Element && event.target.closest(`.${OPERATION_CELL_CLASS}`)) {
          return;
        }

        onRowClick(row, index, event);
      }
    };
  };
}

export function getRowKeyFn(
  rowKey?: string | ((row: AnyObject) => Key)
): ((row: AnyObject) => string) | undefined {
  if (!rowKey) {
    return;
  }

  return row => stringify(
    isFunction(rowKey) ? rowKey(row) : get(row, rowKey)
  );
}

function renderTitle<TRow extends AnyObject>(
  title: PaginatedTableProps<TRow, never>["title"]
): ((data: readonly TRow[]) => ReactNode) | undefined {
  if (!title) {
    return undefined;
  }

  return data => <TableTitle data={data} title={title} />;
}

function renderSummary<TRow extends AnyObject>(
  summary: PaginatedTableProps<TRow, never>["summary"]
): ((data: readonly TRow[]) => ReactNode) | undefined {
  if (!summary) {
    return undefined;
  }

  return data => <TableSummary data={data} summary={summary} />;
}

export function PaginatedTable<TRow extends AnyObject, TParams extends AnyObject>({
  className,
  style,
  size,
  queryFn,
  columns,
  columnSettings,
  rowKey,
  rowSelection,
  queryEnabled,
  queryParams,
  showSequenceColumn,
  operationColumn,
  selectedRowKeys,
  striped,
  virtual,
  title,
  summary,
  onRowClick,
  onSelectedRowKeysChange
}: PaginatedTableProps<TRow, TParams>) {
  const {
    paginationParams,
    sort,
    setPaginationParams
  } = useProTableStore(
    useShallow(state => {
      return {
        paginationParams: state.paginationParams,
        sort: state.sort,
        setPaginationParams: state.setPaginationParams
      };
    })
  );

  const processedColumns = useTableColumns(columns, operationColumn, showSequenceColumn, columnSettings);
  const result = useQuery({
    queryFn,
    queryKey: [
      queryFn.key,
      {
        ...queryParams,
        [SYMBOL_PAGINATION]: paginationParams,
        [SYMBOL_SORT]: sort
      }
    ] as unknown as QueryKey<ParamsWithSort<ParamsWithPagination<TParams>>>,
    enabled: !isFunction(queryEnabled) || queryEnabled(queryParams)
  });

  const paginationProps = usePaginationProps({
    paginationParams,
    total: result.isSuccess ? result.data.total : 0
  });
  const selection = useRowSelection(rowSelection, selectedRowKeys, onSelectedRowKeysChange);
  const emitter = useProTableStore(state => state.eventEmitter);

  useEmitterEvent(emitter, "refetch", () => {
    result.refetch();
  });

  useEffect(() => {
    emitter.emit(result.isFetching ? "loading" : "loaded");
  }, [result.isFetching, emitter]);

  return (
    <Table
      className={className}
      columns={processedColumns}
      css={onRowClick ? clickableRowStyle : undefined}
      dataSource={result.data?.items}
      footer={renderSummary(summary)}
      loading={result.isFetching}
      pagination={paginationProps}
      rowKey={getRowKeyFn(rowKey)}
      rowSelection={selection}
      size={size}
      striped={striped}
      style={style}
      title={renderTitle(title)}
      virtual={virtual}
      onChange={pagination => {
        setPaginationParams({
          page: pagination.current,
          size: pagination.pageSize
        });
      }}
      onRow={buildOnRow(onRowClick)}
    />
  );
}

export function NonPaginatedTable<TRow extends AnyObject, TParams extends AnyObject>({
  className,
  style,
  size,
  queryFn,
  columns,
  columnSettings,
  rowKey,
  rowSelection,
  queryEnabled,
  queryParams,
  showSequenceColumn,
  operationColumn,
  selectedRowKeys,
  striped,
  virtual,
  title,
  summary,
  onRowClick,
  onSelectedRowKeysChange
}: NonPaginatedTableProps<TRow, TParams>) {
  const processedColumns = useTableColumns(columns, operationColumn, showSequenceColumn, columnSettings);
  const sort = useProTableStore(state => state.sort);

  const result = useQuery<TRow[], TRow[], ParamsWithSort<TParams>>({
    queryFn,
    queryKey: [
      queryFn.key,
      {
        ...queryParams,
        [SYMBOL_SORT]: sort
      }
    ] as unknown as QueryKey<ParamsWithSort<TParams>>,
    enabled: !isFunction(queryEnabled) || queryEnabled(queryParams)
  });

  const selection = useRowSelection(rowSelection, selectedRowKeys, onSelectedRowKeysChange);
  const emitter = useProTableStore(state => state.eventEmitter);

  useEmitterEvent(emitter, "refetch", () => {
    result.refetch();
  });

  useEffect(() => {
    emitter.emit(result.isFetching ? "loading" : "loaded");
  }, [result.isFetching, emitter]);

  return (
    <Table
      className={className}
      columns={processedColumns}
      css={onRowClick ? clickableRowStyle : undefined}
      dataSource={result.data}
      footer={renderSummary(summary)}
      loading={result.isFetching}
      pagination={false}
      rowKey={getRowKeyFn(rowKey)}
      rowSelection={selection}
      size={size}
      striped={striped}
      style={style}
      title={renderTitle(title)}
      virtual={virtual}
      onRow={buildOnRow(onRowClick)}
    />
  );
}
