import type { PropsWithChildren, ReactNode } from "react";

import type { Length } from "../_base";

/**
 * Position type for header and footer.
 * - `"inside"`: Inside the main content area
 * - `"outside"`: Spans the full width of the page (including asides)
 */
export type Position = "inside" | "outside";

/**
 * Resizable width configuration for aside panels.
 */
export interface ResizableWidth {
  /**
   * Default width of the panel.
   */
  defaultWidth?: Length;
  /**
   * Minimum width constraint.
   */
  minWidth?: Length;
  /**
   * Maximum width constraint.
   */
  maxWidth?: Length;
}

/**
 * Width type: fixed value or resizable configuration.
 * - `string | number`: Fixed width, not resizable
 * - `ResizableWidth`: Resizable with optional constraints
 */
export type AsideWidth = Length | ResizableWidth;

/**
 * The props of the Page component.
 */
export interface PageProps extends PropsWithChildren {
  /**
   * The class name of the page container.
   */
  className?: string;
  /**
   * Whether the page container has margin.
   * When true, applies var(--vef-spacing-md) margin to the container.
   *
   * @default false
   */
  margin?: boolean;
  /**
   * The gap between grid cells.
   *
   * @default "var(--vef-spacing-md)"
   */
  gap?: Length;
  /**
   * The class name of the main content area.
   */
  mainClassName?: string;
  /**
   * The left aside content of the page.
   */
  leftAside?: ReactNode;
  /**
   * The class name of the left aside.
   */
  leftAsideClassName?: string;
  /**
   * The width of the left aside.
   * - `number | string`: Fixed width
   * - `{ defaultWidth?, minWidth?, maxWidth? }`: Resizable with constraints
   *
   * @default 280
   */
  leftAsideWidth?: AsideWidth;
  /**
   * The right aside content of the page.
   */
  rightAside?: ReactNode;
  /**
   * The class name of the right aside.
   */
  rightAsideClassName?: string;
  /**
   * The width of the right aside.
   * - `number | string`: Fixed width
   * - `{ defaultWidth?, minWidth?, maxWidth? }`: Resizable with constraints
   *
   * @default 280
   */
  rightAsideWidth?: AsideWidth;
  /**
   * The header of the page.
   */
  header?: ReactNode;
  /**
   * The class name of the header.
   */
  headerClassName?: string;
  /**
   * The position of the header.
   * - `"inside"`: Header is inside the main content area (default)
   * - `"outside"`: Header spans the full width of the page (including asides)
   *
   * @default "inside"
   */
  headerPosition?: Position;
  /**
   * The footer of the page.
   */
  footer?: ReactNode;
  /**
   * The class name of the footer.
   */
  footerClassName?: string;
  /**
   * The position of the footer.
   * - `"inside"`: Footer is inside the main content area (default)
   * - `"outside"`: Footer spans the full width of the page (including asides)
   *
   * @default "inside"
   */
  footerPosition?: Position;
  /**
   * The action bar of the page.
   */
  actionBar?: ReactNode;
  /**
   * The class name of the action bar.
   */
  actionBarClassName?: string;
  /**
   * Whether the page main content is scrollable.
   */
  scrollable?: boolean;
  /**
   * Whether the scrollable content has automatic margin for scrollbar spacing.
   * Only effective when scrollable is true.
   *
   * @default false
   */
  scrollMargin?: boolean;
}
