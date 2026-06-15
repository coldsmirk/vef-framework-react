import type { Key } from "@vef-framework-react/shared";

import type { TableRowSelection } from "../../table";
import type { RowSelectionConfig } from "../types";

import { useMemo } from "react";

/**
 * Hook to create row selection configuration for ProTable.
 */
export function useRowSelection<TRow>(
  config: RowSelectionConfig<TRow> | true | undefined,
  selectedRowKeys?: Key[],
  onSelectedRowKeysChange?: (selectedRowKeys: Key[], selectedRows: TRow[]) => void
): TableRowSelection<TRow> | undefined {
  return useMemo(() => {
    if (!config) {
      return;
    }

    const actualConfig = config === true ? {} : config;
    const {
      rowSelectDisabled,
      checkStrictly,
      hideSelectAll,
      preserveSelectedRowKeys,
      defaultSelectedRowKeys
    } = actualConfig;

    return {
      align: "center",
      columnWidth: 40,
      defaultSelectedRowKeys,
      fixed: "left",
      getCheckboxProps: rowSelectDisabled
        ? row => { return { disabled: rowSelectDisabled(row) }; }
        : undefined,
      checkStrictly,
      hideSelectAll,
      preserveSelectedRowKeys,
      selectedRowKeys,
      onChange(keys, rows) {
        onSelectedRowKeysChange?.(keys as Key[], rows);
      }
    };
  }, [selectedRowKeys, onSelectedRowKeysChange, config]);
}
