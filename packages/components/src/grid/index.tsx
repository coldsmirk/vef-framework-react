import type { CSSProperties, ReactElement, ReactNode } from "react";

import type { Breakpoint } from "../_base";
import type { GridContext } from "./context";
import type { GridItemProps, GridProps } from "./props";

import { clsx } from "@vef-framework-react/core";
import { useMergedRef } from "@vef-framework-react/hooks";
import { Children, cloneElement, isValidElement, useCallback, useMemo, useState } from "react";

import { GridContextProvider } from "./context";
import { defaultOffset, defaultSpan, GridItem } from "./grid-item";
import { getResponsiveValue, useContainerBreakpoints, useContainerWidth, useNormalizedGap, useResponsiveBreakpoint } from "./hooks";
import * as styles from "./styles";

interface GridItemInfo {
  element: ReactElement<GridItemProps>;
  span: number;
  offset: number;
}

/**
 * Calculate grid item visibility and apply responsive properties based on collapsed state.
 * When collapsed, items exceeding the specified row limit will be hidden.
 */
function calculateItemVisibility(
  children: ReactNode,
  columns: number,
  collapsed: boolean,
  collapsedRows: number,
  breakpoint: Breakpoint
) {
  const items: GridItemInfo[] = [];
  Children.forEach(children, child => {
    if (!isValidElement(child) || child.type !== GridItem) {
      return;
    }

    const childElement = child as ReactElement<GridItemProps>;
    const childProps = childElement.props;
    const childSpan = getResponsiveValue(childProps.span ?? defaultSpan, breakpoint) ?? defaultSpan;

    if (childSpan === 0) {
      return;
    }

    const childOffset = getResponsiveValue(childProps.offset ?? defaultOffset, breakpoint) ?? defaultOffset;

    items.push({
      element: childElement,
      span: childSpan,
      offset: childOffset
    });
  });

  let suffixItemSpan = 0;
  const maybeSuffixItem = items.at(-1);

  if (maybeSuffixItem?.element.props.suffix === true) {
    suffixItemSpan = maybeSuffixItem.span;
  }

  let spanCount = 0;
  let reachedCollapsedLimit = false;

  const itemNodes: Array<ReactElement<GridItemProps>> = items.map(({
    element,
    span,
    offset
  }, index) => {
    const actualSpan = Math.min(span + offset, columns);

    if (!reachedCollapsedLimit && collapsed) {
      // Calculate remaining columns in the current row
      const remaining = spanCount % columns;

      if (actualSpan + remaining > columns) {
        // Move to next row to prevent item from spanning multiple lines
        spanCount += columns - remaining;
      }

      // Check if adding this item would exceed the collapsed row limit
      if (actualSpan + spanCount + suffixItemSpan > collapsedRows * columns) {
        reachedCollapsedLimit = true;
      } else {
        spanCount += actualSpan;
      }
    }

    if (reachedCollapsedLimit) {
      const { props } = element;

      return cloneElement(element, {
        className: index === items.length - 1 && props.suffix === true
          ? props.className
          : clsx(props.className, "hidden"),
        span,
        offset
      });
    }

    return cloneElement(element, {
      key: element.key || index,
      span: actualSpan,
      offset
    });
  });

  return itemNodes;
}

export function Grid({
  baseWidth = 240,
  gap = 0,
  columnGap,
  rowGap,
  defaultIsCollapsed = false,
  isCollapsed,
  collapsedRows = 1,
  onCollapseChange,
  style,
  children,
  ref,
  ...props
}: GridProps) {
  // Internal state for uncontrolled mode
  const [isCollapsedInternal, setIsCollapsedInternal] = useState(defaultIsCollapsed);

  // Determine if this is controlled or uncontrolled
  const isControlled = isCollapsed !== undefined;
  const mergedIsCollapsed = isControlled ? isCollapsed : isCollapsedInternal;

  // Set collapsed function that handles both controlled and uncontrolled modes
  const setCollapsed = useCallback((isCollapsed?: boolean) => {
    const state = isCollapsed || !mergedIsCollapsed;

    if (!isControlled) {
      setIsCollapsedInternal(state);
    }

    onCollapseChange?.(state);
  }, [isControlled, mergedIsCollapsed, onCollapseChange]);

  const { containerRef, containerWidth } = useContainerWidth();
  const mergedContainerRef = useMergedRef(containerRef, ref);
  const breakpoints = useContainerBreakpoints(baseWidth);
  const breakpoint = useResponsiveBreakpoint(breakpoints, containerWidth);
  // Use gap as fallback when columnGap or rowGap are not explicitly provided
  const [normalizedRowGap, normalizedColumnGap] = useNormalizedGap([rowGap ?? gap, columnGap ?? gap]);

  // Calculate dynamic grid styles based on container width
  const gridStyle: CSSProperties = useMemo(() => {
    if (containerWidth > styles.gridColumns * normalizedColumnGap) {
      return {
        "--vef-grid-row-gap": `${normalizedRowGap}px`,
        "--vef-grid-column-gap": `${normalizedColumnGap}px`,
        ...style
      };
    }

    return {
      "--vef-grid-row-gap": `${normalizedRowGap}px`,
      "--vef-grid-column-gap": `${Math.floor(containerWidth / styles.gridColumns)}px`,
      ...style
    };
  }, [containerWidth, normalizedColumnGap, normalizedRowGap, style]);

  // Create context value for grid item components
  const context: GridContext = useMemo(() => {
    return {
      gridColumns: styles.gridColumns,
      isCollapsed: mergedIsCollapsed,
      setCollapsed
    };
  }, [mergedIsCollapsed, setCollapsed]);

  // Apply visibility logic and responsive properties to grid items
  const processedGridItems = useMemo(
    () => calculateItemVisibility(children, styles.gridColumns, mergedIsCollapsed, collapsedRows, breakpoint),
    [children, mergedIsCollapsed, collapsedRows, breakpoint]
  );

  return (
    <div
      {...props}
      ref={mergedContainerRef}
      css={styles.grid}
      style={gridStyle}
    >
      <GridContextProvider value={context}>
        {processedGridItems}
      </GridContextProvider>
    </div>
  );
}

Grid.Item = GridItem;

export { useGridCollapsed } from "./hooks";
export { type GridItemProps, type GridProps, type ResponsiveValue } from "./props";
