import type { PaginationParams } from "@vef-framework-react/core";
import type { Key } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { Length } from "../_base";
import type { SYMBOL_PAGINATION, SYMBOL_SORT } from "../_base/constants";
import type { OrderSpec } from "../_base/types";

/**
 * Configuration for column settings feature
 */
export interface ColumnSettingsConfig {
  /**
   * Storage key for persisting column settings to localStorage.
   * If provided, settings will be saved with key: `__VEF_PRO_TABLE_COLUMN_SETTINGS__${storageKey}`
   * If not provided, settings will not be persisted.
   */
  storageKey?: string;
}

/**
 * Column settings prop type.
 * - `false`: Disable column settings feature, hide settings icon
 * - `ColumnSettingsConfig`: Enable column settings with optional persistence
 */
export type ColumnSettingsProp = false | ColumnSettingsConfig;

/**
 * Imperative handle for ProTable component.
 * Exposed via ref to allow parent components to programmatically control the table.
 */
export interface ProTableRef {
  /**
   * Manually trigger a data refetch.
   * Useful when you need to refresh the table data after external changes.
   */
  refetch: () => void;
  /**
   * Register a callback to be invoked when table starts loading data
   */
  onLoading: (callback: () => void) => () => void;
  /**
   * Register a callback to be invoked when table finishes loading data
   */
  onLoaded: (callback: () => void) => () => void;
}

/**
 * Represents request parameters enhanced with pagination metadata.
 */
export type ParamsWithPagination<TParams> = TParams & {
  [SYMBOL_PAGINATION]?: PaginationParams;
};

/**
 * Represents request parameters enhanced with sort metadata.
 */
export type ParamsWithSort<TParams> = TParams & {
  [SYMBOL_SORT]?: OrderSpec[];
};

/**
 * Configuration for the operation column which renders per-row actions
 */
export interface OperationColumnConfig<TRow> {
  /**
   * Column width. Accepts any valid `Length` value.
   */
  width?: Length;
  /**
   * Column header title. Can be plain text or a React node.
   */
  title?: ReactNode;
  /**
   * Permissions required to display the operation content.
   * Use this to conditionally hide actions based on authorization.
   */
  requiredPermissions?: string[];
  /**
   * Render function for the operation cell of a row.
   * Receives the current row data and its index, and should return a React node
   * that contains operation elements (e.g., buttons, menus).
   */
  render: (row: TRow, index: number) => ReactNode;
}

/**
 * The configuration for the row selection of the table.
 */
export interface RowSelectionConfig<TRow> {
  /**
   * If set, row selection will be disabled for the row with the function returns true
   */
  rowSelectDisabled?: (model: TRow) => boolean;
  /**
   * Keep the selection keys in list even the key not exist in `dataSource` anymore
   */
  checkStrictly?: boolean;
  /**
   * Whether hide select all checkbox
   */
  hideSelectAll?: boolean;
  /**
   * Keep the selection keys in list even the key not exist in `dataSource` anymore
   */
  preserveSelectedRowKeys?: boolean;
  /**
   * The default selected row keys
   */
  defaultSelectedRowKeys?: Key[];
}
