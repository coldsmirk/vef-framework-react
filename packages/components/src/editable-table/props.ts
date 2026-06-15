import type { AnyObject, DeepKeys, Key } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { Length } from "../_base";
import type { TableProps } from "../table";
import type { EditableRowActionsTexts } from "./components";
import type { EditableColumn } from "./types";

/**
 * Overrides for the appended operation column.
 */
export interface EditableOperationColumnConfig {
  title?: ReactNode;
  width?: Length;
  texts?: EditableRowActionsTexts;
}

/**
 * Props for {@link EditableTable}. The component is a controlled form control:
 * `value` is the full row array, and every edit / add / delete is just an
 * operation on that array surfaced through `onChange` — there is no query or
 * mutation involved.
 */
export interface EditableTableProps<TRow extends AnyObject> {
  /**
   * Controlled row data.
   */
  value: TRow[];
  /**
   * Emitted with the next array on every edit / add / delete.
   */
  onChange?: (value: TRow[]) => void;
  /**
   * Column definitions with read (`renderView`) and edit (`renderEditor`) slots.
   */
  columns: Array<EditableColumn<NoInfer<TRow>>>;
  /**
   * Row identity: a field name or a function; defaults to the `key` field.
   * Provides stable identity for the editing row.
   */
  rowKey?: DeepKeys<NoInfer<TRow>> | ((row: NoInfer<TRow>) => Key);
  /**
   * Whether a row can enter edit mode. Accepts a boolean or a per-row
   * predicate. Defaults to `true`.
   */
  canEdit?: boolean | ((row: NoInfer<TRow>) => boolean);
  /**
   * Whether a row can be deleted. Accepts a boolean or a per-row predicate.
   * Defaults to `false`.
   */
  canDelete?: boolean | ((row: NoInfer<TRow>) => boolean);
  /**
   * Show the add-row button below the table.
   */
  creatable?: boolean;
  /**
   * Factory for a new row's default values when adding.
   */
  createRecord?: () => Partial<TRow>;
  /**
   * Extra read-mode actions rendered before the built-in Edit / Delete buttons.
   */
  renderRowActions?: (row: NoInfer<TRow>, index: number) => ReactNode;
  /**
   * Operation column overrides (title / width / button labels).
   */
  operationColumn?: EditableOperationColumnConfig;
  /**
   * Table density, forwarded to the underlying table.
   */
  size?: TableProps<NoInfer<TRow>>["size"];
  /**
   * Client-side pagination config, forwarded to the underlying table. Off by default.
   */
  pagination?: TableProps<NoInfer<TRow>>["pagination"];
}
