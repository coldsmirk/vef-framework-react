import type { AnyObject } from "@vef-framework-react/shared";

import type { TableColumn } from "../../table";
import type { ColumnSettingsProp, OperationColumnConfig } from "../types";

import { css } from "@emotion/react";
import { useCheckPermission } from "@vef-framework-react/hooks";
import { isDeepEqual, isNullish, shouldUpdateByKeys } from "@vef-framework-react/shared";
import { useEffect, useMemo, useRef } from "react";

import { globalCssVars } from "../../_base";
import { Group } from "../../group";
import { ColumnSettings } from "../components";
import { getColumnId, useProTableStore } from "../store";

/**
 * Class applied to every cell of the built-in operation column so the
 * `onRowClick` handler can tell row-surface clicks apart from clicks on
 * per-row actions.
 */
export const OPERATION_CELL_CLASS = "vef-table-operation-cell";

const operationHeaderStyle = css({
  userSelect: "none"
});
const operationTitleStyle = css({
  flex: "auto",
  textAlign: "center"
});
const settingsIconStyle = css({
  marginRight: globalCssVars.spacingXxs,
  paddingInline: globalCssVars.spacingXxs,
  paddingBlock: globalCssVars.spacingXs,
  cursor: "pointer",
  fontSize: globalCssVars.fontSizeSm,
  color: "var(--vef-table-header-icon-color)",
  borderRadius: globalCssVars.borderRadius,
  transitionProperty: "color, background",
  transitionDuration: globalCssVars.motionDurationSlow,

  "&:hover": {
    color: globalCssVars.colorIcon,
    backgroundColor: "var(--vef-table-header-filter-hover-bg)"
  }
});

/**
 * The hook to use the table columns.
 *
 * @param tableColumns - The columns of the table.
 * @param operationColumn - The operation column of the table.
 * @param showSequenceColumn - Whether to show the sequence column. Default is true.
 * @param columnSettingsProp - Column settings configuration.
 * @returns The table columns.
 */
export function useTableColumns<TRow extends AnyObject>(
  tableColumns: Array<TableColumn<TRow>>,
  operationColumn?: OperationColumnConfig<TRow>,
  showSequenceColumn = true,
  columnSettingsProp: ColumnSettingsProp = {}
): Array<TableColumn<TRow>> {
  const checkPermission = useCheckPermission();
  const paginationParams = useProTableStore(state => state.paginationParams);
  const columnSettings = useProTableStore(state => state.columnSettings);
  const initColumnSettings = useProTableStore(state => state.initColumnSettings);
  const prevColumnOrderRef = useRef<string[]>([]);
  const isColumnSettingsEnabled = columnSettingsProp !== false;

  useEffect(() => {
    initColumnSettings(tableColumns);
  }, [tableColumns, initColumnSettings]);

  return useMemo(() => {
    const settingMap = new Map(columnSettings.map((cs, index) => [cs.id, { settings: cs, order: index }]));

    const applySetting = (column: TableColumn<TRow>, index: number): TableColumn<TRow> => {
      const entry = settingMap.get(getColumnId(column, index));

      if (!entry) {
        return column;
      }

      return {
        ...column,
        fixed: entry.settings.fixed || column.fixed,
        width: entry.settings.width ?? column.width
      };
    };

    const columnOrderMap = new WeakMap<TableColumn<TRow>, number>();
    const sortedTableColumns = columnSettings.length > 0
      ? [...tableColumns]
          .filter((column, index) => {
            const entry = settingMap.get(getColumnId(column, index));

            if (entry) {
              columnOrderMap.set(column, entry.order);
            }

            // If no settings found, show the column by default
            return entry?.settings.visible !== false;
          })
          .toSorted((columnA, columnB) => {
            const orderA = columnOrderMap.get(columnA) ?? -1;
            const orderB = columnOrderMap.get(columnB) ?? -1;

            // If not found in settings, keep original order
            if (orderA === -1 && orderB === -1) {
              return 0;
            }

            if (orderA === -1) {
              return 1;
            }

            if (orderB === -1) {
              return -1;
            }

            return orderA - orderB;
          })
      : tableColumns;

    const currentColumnOrder = sortedTableColumns.map((column, index) => getColumnId(column, index));
    const prevColumnOrder = prevColumnOrderRef.current;

    const processedTableColumns = sortedTableColumns
      .map((column, index) => applySetting(column, index))
      .map((column, index) => {
        const columnId = getColumnId(column, index);
        const prevIndex = prevColumnOrder.indexOf(columnId);
        const positionChanged = prevIndex !== -1 && prevIndex !== index;

        const originalShouldCellUpdate = column.shouldCellUpdate
          ?? (isNullish(column.dataIndex) ? undefined : shouldUpdateByKeys(column.dataIndex as never));

        if (originalShouldCellUpdate) {
          column.shouldCellUpdate = (next, prev) => {
            // If column position changed, always update
            if (positionChanged) {
              return true;
            }

            return originalShouldCellUpdate(next, prev);
          };
        }

        return column;
      });
    const columns: Array<TableColumn<TRow>> = showSequenceColumn
      ? [
          {
            title: "序号",
            width: 60,
            align: "center",
            fixed: "start",
            key: "__sequence",
            render(_value, _row, index) {
              // Calculate sequence number based on pagination
              // For paginated tables: (page - 1) * pageSize + index + 1
              // For non-paginated tables: index + 1
              const page = paginationParams?.page;
              const size = paginationParams?.size;

              if (page && size) {
                return (page - 1) * size + index + 1;
              }

              return index + 1;
            }
          } as TableColumn<TRow>,
          ...processedTableColumns
        ]
      : [...processedTableColumns];

    if (!operationColumn) {
      // Update ref for next render comparison
      prevColumnOrderRef.current = currentColumnOrder;
      return columns;
    }

    const {
      title,
      width,
      requiredPermissions,
      render
    } = operationColumn;

    if (requiredPermissions) {
      const isOperationColumnVisible = checkPermission(requiredPermissions, "any");

      if (!isOperationColumnVisible) {
        // Update ref for next render comparison
        prevColumnOrderRef.current = currentColumnOrder;
        return columns;
      }
    }

    columns.push({
      title: (
        <Group css={operationHeaderStyle}>
          <span css={operationTitleStyle}>{title || "操作"}</span>
          {isColumnSettingsEnabled && <ColumnSettings css={settingsIconStyle} />}
        </Group>
      ),
      width,
      className: OPERATION_CELL_CLASS,
      fixed: "end",
      key: "__operations",
      shouldCellUpdate: (current, prev) => !isDeepEqual(current, prev),
      render(_value, row, index) {
        return render(row, index);
      }
    } as TableColumn<TRow>);

    // Update ref for next render comparison
    prevColumnOrderRef.current = currentColumnOrder;

    return columns;
  }, [tableColumns, operationColumn, checkPermission, showSequenceColumn, paginationParams.page, paginationParams.size, columnSettings, isColumnSettingsEnabled]);
}
