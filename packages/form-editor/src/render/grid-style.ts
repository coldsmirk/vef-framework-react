import type { CSSProperties } from "react";

import type { GridNode } from "../types";

import { ROW_COLS } from "../types";

/**
 * Shared grid-layout mapping for the runtime renderer and the editor canvas, so
 * a {@link GridNode}'s columns / gaps render identically in both. The explicit
 * grid is a real CSS grid (`grid-template-columns: repeat(N, 1fr)`) — its cells
 * flow across the columns and wrap, and a cell's `span` widens it.
 */

export const GRID_DEFAULT_COLUMNS = 2;

/**
 * Resolve a grid's effective column count, clamped to `1..ROW_COLS`.
 */
export function gridColumnCount(grid: GridNode): number {
  const columns = grid.columns ?? GRID_DEFAULT_COLUMNS;

  return Math.max(1, Math.min(ROW_COLS, Math.floor(columns)));
}

/**
 * Style for the grid container: the track template plus column / row gaps. The
 * gaps fall back to `gap`, then to the form density gutter.
 */
export function gridContainerStyle(grid: GridNode, gutter: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${gridColumnCount(grid)}, minmax(0, 1fr))`,
    columnGap: grid.gap ?? gutter,
    rowGap: grid.rowGap ?? grid.gap ?? gutter
  };
}

/**
 * Style for one grid cell: how many columns it spans (`1..columns`). `minWidth: 0`
 * lets an input-bearing cell shrink below its content's intrinsic width instead
 * of forcing the track to overflow.
 */
export function gridCellStyle(span: number | undefined, columns: number): CSSProperties {
  const clamped = span === undefined ? 1 : Math.max(1, Math.min(columns, Math.floor(span)));

  return {
    minWidth: 0,
    gridColumn: clamped > 1 ? `span ${clamped}` : undefined
  };
}
