import type { ScrollAreaProps as ScrollAreaPropsInternal } from "@radix-ui/react-scroll-area";
import type { Except } from "@vef-framework-react/shared";
import type { ComponentPropsWithRef, CSSProperties, Ref } from "react";

import type { Length, Position } from "../_base";

export type ScrollAreaScrollbars = "both" | "vertical" | "horizontal";

/**
 * The props for the ScrollArea component.
 */
export interface ScrollAreaProps extends Except<ComponentPropsWithRef<"div">, "dir">, Pick<ScrollAreaPropsInternal, "type" | "scrollHideDelay"> {
  /**
   * Which scrollbar axes to render.
   *
   * @default "both"
   */
  scrollbars?: ScrollAreaScrollbars;
  /**
   * The size of the scrollbar
   *
   * @default "10px"
   */
  scrollbarSize?: Length;
  /**
   * The padding of the scrollbar
   *
   * @default "2px"
   */
  scrollbarPadding?: Length;
  /**
   * The ref of the viewport element
   */
  viewportRef?: Ref<HTMLDivElement>;
  /**
   * The class name of the viewport element
   */
  viewportClassName?: string;
  /**
   * The style of the viewport element
   */
  viewportStyle?: CSSProperties;
  /**
   * Controls the behavior when scrolling beyond the boundaries
   */
  overscrollBehavior?: CSSProperties["overscrollBehavior"];
  /**
   * Callback fired when the scroll position changes
   */
  onScrollPositionChange?: (position: Position) => void;
  /**
   * Callback fired when scrolled to the top
   */
  onTopReached?: () => void;
  /**
   * Callback fired when scrolled to the bottom
   */
  onBottomReached?: () => void;
}
