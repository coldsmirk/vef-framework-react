import type { CSSProperties } from "react";

import type { ScrollAreaProps } from "./props";

import {
  Corner,
  Root,
  Scrollbar,
  Thumb,
  Viewport
} from "@radix-ui/react-scroll-area";
import { useMemo } from "react";

import { getSpacingValue } from "../_base";
import * as styles from "./styles";

export function ScrollArea({
  ref,
  scrollbarSize,
  scrollbarPadding,
  viewportRef,
  viewportClassName,
  viewportStyle,
  overscrollBehavior,
  onScrollPositionChange,
  onTopReached,
  onBottomReached,
  children,
  ...rootProps
}: ScrollAreaProps) {
  const { style: rootStyle, ...restRootProps } = rootProps;
  const mergedRootStyle = useMemo<CSSProperties>(() => {
    return {
      ...rootStyle,
      "--vef-scrollbar-size": getSpacingValue(scrollbarSize ?? 10),
      "--vef-scrollbar-padding": getSpacingValue(scrollbarPadding ?? 2)
    };
  }, [scrollbarSize, scrollbarPadding, rootStyle]);

  const mergedViewportStyle = useMemo<CSSProperties>(() => {
    return {
      ...viewportStyle,
      "--vef-overscroll-behavior": overscrollBehavior ?? "none"
    };
  }, [overscrollBehavior, viewportStyle]);

  return (
    <Root
      ref={ref as never}
      css={styles.root}
      style={mergedRootStyle}
      {...restRootProps}
    >
      <Viewport
        ref={viewportRef}
        className={viewportClassName}
        css={styles.viewport}
        style={mergedViewportStyle}
        onScroll={event => {
          onScrollPositionChange?.({
            x: event.currentTarget.scrollLeft,
            y: event.currentTarget.scrollTop
          });
          const {
            scrollTop,
            scrollHeight,
            clientHeight
          } = event.currentTarget;

          // threshold of -0.6 is required for some browsers that use sub-pixel rendering
          if (scrollTop - (scrollHeight - clientHeight) >= -0.6) {
            onBottomReached?.();
          }

          if (scrollTop === 0) {
            onTopReached?.();
          }
        }}
      >
        {children}
      </Viewport>

      <Scrollbar
        css={styles.scrollbar}
        orientation="vertical"
      >
        <Thumb css={styles.thumb} />
      </Scrollbar>

      <Scrollbar
        css={[styles.scrollbar]}
        orientation="horizontal"
      >
        <Thumb css={styles.thumb} />
      </Scrollbar>

      <Corner />
    </Root>
  );
}

export { type ScrollAreaProps } from "./props";
