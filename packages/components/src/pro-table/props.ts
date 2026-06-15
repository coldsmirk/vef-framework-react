import type { PaginationResult, QueryFunction } from "@vef-framework-react/core";
import type { AnyObject, DeepKeys, Key } from "@vef-framework-react/shared";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

import type { TableColumn, TableProps } from "../table";
import type { ColumnSettingsProp, OperationColumnConfig, ParamsWithPagination, ParamsWithSort, RowSelectionConfig } from "./types";

/**
 * Base props for ProTable component
 *
 * @template TRow - The type of table row data
 * @template TParams - The type of query parameters
 */
interface BaseProTableProps<TRow extends AnyObject, TParams extends AnyObject> extends Pick<TableProps<TRow>, "size"> {
  /**
   * Class name for the table container
   */
  className?: string;
  /**
   * Inline styles for the table container
   */
  style?: CSSProperties;
  /**
   * Table column definitions
   */
  columns: Array<TableColumn<NoInfer<TRow>>>;
  /**
   * Column settings configuration.
   * - `false`: Disable column settings feature
   * - `{ storageKey?: string }`: Enable with optional localStorage persistence
   *
   * @default {}
   */
  columnSettings?: ColumnSettingsProp;
  /**
   * Whether to show the sequence (row number) column. Default is true.
   */
  showSequenceColumn?: boolean;
  /**
   * Row key extractor: either a deep key of the row model or a function
   */
  rowKey?: DeepKeys<NoInfer<TRow>> | ((row: NoInfer<TRow>) => Key);
  /**
   * Enable virtual scrolling for the table to improve performance with large datasets
   *
   * @default false
   */
  virtual?: boolean;
  /**
   * Render zebra-striped table rows
   *
   * @default false
   */
  striped?: boolean;
  /**
   * Currently selected row keys
   */
  selectedRowKeys?: Key[];
  /**
   * Operation column configuration for per-row actions
   */
  operationColumn?: OperationColumnConfig<NoInfer<TRow>>;
  /**
   * Row selection configuration
   * - `true`: Enable row selection with default configuration
   * - `RowSelectionConfig<TRow>`: Enable row selection with custom configuration
   * - `undefined`: Disable row selection (default)
   */
  rowSelection?: RowSelectionConfig<NoInfer<TRow>> | true;
  /**
   * Function to determine whether the query should be enabled
   */
  queryEnabled?: (params?: TParams) => boolean;
  /**
   * Query parameters that trigger re-fetching when changed.
   */
  queryParams?: TParams;
  /**
   * Custom header content to be rendered above the title
   */
  header?: ReactNode;
  /**
   * Title to be displayed above the table
   */
  title?: ReactNode;
  /**
   * Summary information to be displayed below the table
   */
  summary?: ReactNode;
  /**
   * Custom footer content to be rendered below the summary
   */
  footer?: ReactNode;
  /**
   * Callback fired when a table body row is clicked.
   *
   * Clicks inside the built-in operation column are ignored so per-row action
   * buttons do not also trigger the row-level action. Interactive elements
   * rendered in custom cells should call `event.stopPropagation()` to opt out.
   */
  onRowClick?: (row: TRow, index: number | undefined, event: MouseEvent<HTMLElement>) => void;
  /**
   * Callback when selected row keys change
   */
  onSelectedRowKeysChange?: (keys: Key[], rows: TRow[]) => void;
}

/**
 * Props for paginated ProTable
 *
 * @template TRow - The type of table row data
 * @template TParams - The type of query parameters
 */
export interface PaginatedProTableProps<TRow extends AnyObject, TParams extends AnyObject>
  extends BaseProTableProps<TRow, TParams> {
  /**
   * Enable pagination mode. Default is true.
   */
  isPaginated?: true;
  /**
   * Query function for fetching paginated data
   */
  queryFn: QueryFunction<PaginationResult<TRow>, ParamsWithSort<ParamsWithPagination<TParams>>>;
}

/**
 * Props for non-paginated ProTable
 *
 * @template TRow - The type of table row data
 * @template TParams - The type of query parameters
 */
export interface NonPaginatedProTableProps<TRow extends AnyObject, TParams extends AnyObject>
  extends BaseProTableProps<TRow, TParams> {
  /**
   * Disable pagination mode for this variant
   */
  isPaginated: false;
  /**
   * Query function for fetching the full list data
   */
  queryFn: QueryFunction<TRow[], ParamsWithSort<TParams>>;
}

/**
 * Discriminated union of paginated and non-paginated ProTable props
 */
export type ProTableProps<TRow extends AnyObject, TParams extends AnyObject>
  = PaginatedProTableProps<TRow, TParams>
    | NonPaginatedProTableProps<TRow, TParams>;
