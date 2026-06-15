import type { AnyObject } from "@vef-framework-react/shared";
import type { TableProps as TablePropsInternal } from "antd";

import type { TableProps } from "./props";

import { css } from "@emotion/react";
import { clsx } from "@vef-framework-react/core";
import { useElementSize, useMergedRef } from "@vef-framework-react/hooks";
import { isFunction, isString, toInt } from "@vef-framework-react/shared";
import { Table as TableInternal } from "antd";
import { useEffect, useMemo, useRef } from "react";

import { globalCssVars, styles } from "../_base";

export { type TableProps } from "./props";
export { pageSizeOptions, usePaginationProps } from "./use-pagination-props";

export type { TableColumnType as TableColumn, TablePaginationConfig } from "antd";

const DEFAULT_COLUMN_WIDTH = 200;

const STRIPED_ROW_CLASS = "vef-table-row-striped";

// Stripe and hover tints are composited as an opaque pair (container
// background-color + translucent fill as a background-image layer): fixed
// columns need an opaque background to mask the content scrolling beneath
// them, and the pair adapts to dark mode through the --vef-* vars. Both rules
// yield to antd's row-selected background via the :not() guards — VEF styles
// are unlayered and would otherwise always win over the antd layer.
// The antd class prefix is "vef-", set by the framework's ConfigProvider.
const stripedStyle = css({
  [`.vef-table-tbody .vef-table-row.${STRIPED_ROW_CLASS}:not(.vef-table-row-selected) > .vef-table-cell:not(.vef-table-cell-row-hover)`]: {
    backgroundColor: globalCssVars.colorBgContainer,
    backgroundImage: `linear-gradient(${globalCssVars.colorFillQuaternary}, ${globalCssVars.colorFillQuaternary})`
  },
  // antd v6's default rowHoverBg is the solid blend of colorFillAlter, which
  // is visually identical to the stripe tint — hovered striped rows would not
  // change. Striped tables therefore lift hover to the next fill step,
  // uniformly for striped and unstriped rows.
  ".vef-table-tbody .vef-table-row:not(.vef-table-row-selected) > .vef-table-cell-row-hover": {
    backgroundColor: globalCssVars.colorBgContainer,
    backgroundImage: `linear-gradient(${globalCssVars.colorFillTertiary}, ${globalCssVars.colorFillTertiary})`
  }
});

function calculateVirtualScrollX<TRow>(columns: TableProps<TRow>["columns"]): number {
  return (columns || [])
    .map(column => {
      if (isString(column.width)) {
        return toInt(column.width);
      }

      return column.width || column.minWidth || DEFAULT_COLUMN_WIDTH;
    })
    .reduce((acc, width) => acc + width, 0);
}

export function Table<TRow = AnyObject>({
  className,
  style,
  flexHeight = true,
  striped = false,
  virtual = false,
  columns,
  rowClassName,
  ...restProps
}: TableProps<TRow>) {
  const tableElRef = useRef<HTMLDivElement>(null);
  const { ref: tableSizeRef, height: tableHeight } = useElementSize();
  const tableRef = useMergedRef(tableElRef, tableSizeRef);
  const { ref: headerSizeRef, height: tableHeaderHeight } = useElementSize();

  useEffect(() => {
    const header = tableElRef.current?.querySelector(".vef-table-header");

    if (header) {
      headerSizeRef(header);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  }, [tableElRef.current, headerSizeRef]);

  const tableProps = useMemo<TablePropsInternal<TRow>>(() => {
    if (!flexHeight) {
      return { columns };
    }

    const scrollX = virtual ? calculateVirtualScrollX(columns) : "max-content";
    const scrollY = virtual ? tableHeight - tableHeaderHeight : "100%";

    return {
      columns,
      scroll: {
        scrollToFirstRowOnChange: true,
        x: scrollX,
        y: scrollY
      },
      sticky: false,
      virtual
    };
  }, [tableHeight, tableHeaderHeight, columns, flexHeight, virtual]);

  // Striping by row index (instead of CSS :nth-child) keeps the parity correct
  // across the measure row antd injects, expanded rows, and virtual scrolling,
  // where only a window of rows is in the DOM.
  const mergedRowClassName: TableProps<TRow>["rowClassName"] = striped
    ? (row, index, indent) => clsx(
        index % 2 === 1 && STRIPED_ROW_CLASS,
        isFunction(rowClassName) ? rowClassName(row, index, indent) : rowClassName
      )
    : rowClassName;

  return (
    <div
      ref={tableRef}
      className={className}
      css={[styles.fullHeight, striped && stripedStyle]}
      style={style}
    >
      <TableInternal
        {...restProps}
        rowClassName={mergedRowClassName}
        {...tableProps}
      />
    </div>
  );
}

export type { TableRowSelection } from "antd/es/table/interface";
