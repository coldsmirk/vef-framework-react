import type { DynamicIconName } from "../dynamic-icon";

import { css } from "@emotion/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useEffect, useMemo, useRef } from "react";

import { globalCssVars } from "../_base";
import { DynamicIcon, dynamicIconNames } from "../dynamic-icon";
import { Empty } from "../empty";
import { ScrollArea } from "../scroll-area";

// Grid geometry. Cell height is fixed (so row virtualization stays cheap and
// stable); columns are an equal-fraction CSS grid, so a short final row keeps
// its cells the same size as every other row and left-aligned (no stretching).
const COLUMNS = 8;
const CELL_HEIGHT = 40;
const GAP = 4;
const ROW_PITCH = CELL_HEIGHT + GAP;

/**
 * Intrinsic width of the grid (8 columns + gaps). Exported so the picker can pin
 * the popup to it instead of stretching to the trigger width.
 */
export const ICON_GRID_WIDTH = COLUMNS * CELL_HEIGHT + (COLUMNS - 1) * GAP;

const VIEWPORT_HEIGHT = ROW_PITCH * 6;

// The full lucide name list, materialized once. Names are already lowercase
// kebab-case, so substring search needs no per-entry normalization.
const ICON_NAMES = [...dynamicIconNames];

const scrollAreaStyle = css({
  width: ICON_GRID_WIDTH,
  maxWidth: "100%",
  height: VIEWPORT_HEIGHT
});

const canvasStyle = css({
  position: "relative",
  width: "100%"
});

const rowStyle = css({
  position: "absolute",
  insetInlineStart: 0,
  top: 0,
  display: "grid",
  gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
  gap: GAP,
  width: "100%",
  height: CELL_HEIGHT
});

const cellStyle = css({
  minWidth: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: CELL_HEIGHT,
  padding: 0,
  border: "none",
  borderRadius: globalCssVars.borderRadius,
  background: "transparent",
  color: globalCssVars.colorTextSecondary,
  fontSize: 20,
  cursor: "pointer",
  transition: `background-color ${globalCssVars.motionDurationFast}, color ${globalCssVars.motionDurationFast}`,
  "&:hover": {
    backgroundColor: globalCssVars.controlItemBgHover,
    color: globalCssVars.colorText
  },
  "&.vef-icon-picker-cell-selected": {
    backgroundColor: globalCssVars.colorPrimaryBg,
    color: globalCssVars.colorPrimary
  }
});

const emptyStyle = css({
  width: ICON_GRID_WIDTH,
  maxWidth: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  paddingBlock: globalCssVars.paddingMd
});

interface IconGridProps {
  /**
   * The selected icon name (for highlighting), or `null` when unset.
   */
  value: string | null;
  /**
   * The search keyword to filter icon names against.
   */
  keyword: string;
  /**
   * Commit the icon name of a clicked cell.
   */
  onSelect: (name: DynamicIconName) => void;
  /**
   * Dismiss the popup after a pick.
   */
  onClose: () => void;
}

/**
 * The icon-picker popup body: a virtualized, searchable grid over the full
 * lucide icon set. Only the rows in (and near) the viewport are mounted, and the
 * shared icon loader caps concurrent chunk imports — so the ~2000-icon set never
 * floods the bundler with a request per cell.
 *
 * Memoized, and fed stable `onSelect`/`onClose` by {@link GenericSelect}, so it
 * is skipped while the user types in the trigger search box (only the debounced
 * `keyword` actually re-renders it).
 */
export const IconGrid = memo(({
  value,
  keyword,
  onSelect,
  onClose
}: IconGridProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const names = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();
    return trimmed ? ICON_NAMES.filter(name => name.includes(trimmed)) : ICON_NAMES;
  }, [keyword]);

  const rowCount = Math.ceil(names.length / COLUMNS);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_PITCH,
    overscan: 3,
    // Seed a viewport size so the first rows mount before the scroll element is
    // measured (first paint, and layout-less test environments).
    initialRect: { width: ICON_GRID_WIDTH, height: VIEWPORT_HEIGHT }
  });

  // A new search collapses the result set; snap back to the top so the first
  // matches are visible instead of stranding the user at a stale scroll offset.
  useEffect(() => {
    rowVirtualizer.scrollToOffset(0);
  }, [names, rowVirtualizer]);

  if (names.length === 0) {
    return (
      <div css={emptyStyle}>
        <Empty description="无匹配图标" />
      </div>
    );
  }

  return (
    <ScrollArea
      css={scrollAreaStyle}
      viewportRef={scrollRef}
    >
      <div css={canvasStyle} style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map(row => {
          const offset = row.index * COLUMNS;

          return (
            <div
              key={row.key}
              css={rowStyle}
              style={{ transform: `translateY(${row.start}px)` }}
            >
              {names.slice(offset, offset + COLUMNS).map(name => (
                <button
                  key={name}
                  aria-label={name}
                  aria-selected={name === value}
                  className={name === value ? "vef-icon-picker-cell-selected" : undefined}
                  css={cellStyle}
                  title={name}
                  type="button"
                  onClick={() => {
                    onSelect(name);
                    onClose();
                  }}
                >
                  <DynamicIcon name={name} />
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
});

IconGrid.displayName = "IconGrid";
