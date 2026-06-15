import type { LiteralUnion } from "@vef-framework-react/shared";
import type { ComponentProps } from "react";

import type { Breakpoint, FullSize } from "../_base";

/**
 * Responsive breakpoint type for grid system
 */
export type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>;

/**
 * The props for the Grid component.
 */
export interface GridProps extends ComponentProps<"div"> {
  /**
   * The base width of the grid item.
   */
  baseWidth?: number;
  /**
   * The gap between both columns and rows.
   * This is a convenience property that sets both columnGap and rowGap to the same value.
   * If columnGap or rowGap are explicitly set, they will take precedence over this value.
   *
   * @default 0
   */
  gap?: LiteralUnion<FullSize, number>;
  /**
   * The gap between columns.
   *
   * @default 0
   */
  columnGap?: LiteralUnion<FullSize, number>;
  /**
   * The gap between rows.
   *
   * @default 0
   */
  rowGap?: LiteralUnion<FullSize, number>;
  /**
   * The default value of isCollapsed.
   *
   * @default false
   */
  defaultIsCollapsed?: boolean;
  /**
   * Whether to enable collapsed mode.
   *
   * @default false
   */
  isCollapsed?: boolean;
  /**
   * Number of rows to display when isCollapsed.
   *
   * @default 1
   */
  collapsedRows?: number;
  /**
   * Callback function when isCollapsed is changed.
   *
   * @param isCollapsed - The new value of isCollapsed.
   */
  onCollapseChange?: (isCollapsed: boolean) => void;
}

/**
 * The props for the GridItem component.
 */
export interface GridItemProps extends ComponentProps<"div"> {
  /**
   * Number of columns the grid item spans.
   * Supports responsive values.
   *
   * @default 1
   */
  span?: ResponsiveValue<number>;
  /**
   * Number of columns to offset the grid item.
   * Supports responsive values.
   *
   * @default 0
   */
  offset?: ResponsiveValue<number>;
  /**
   * Whether this item should be positioned as a suffix item (aligned to the end).
   *
   * @default false
   */
  suffix?: boolean;
}
