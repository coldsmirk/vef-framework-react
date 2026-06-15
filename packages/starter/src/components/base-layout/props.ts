import type { PropsWithChildren, ReactNode } from "react";

/**
 * The props of the BaseLayout component.
 */
export interface BaseLayoutProps extends PropsWithChildren {
  /**
   * The class of the main content.
   */
  className?: string;
  /**
   * The header of the layout.
   */
  header?: ReactNode;
  /**
   * The height of the header.
   */
  headerHeight?: number;
  /**
   * The class of the header.
   */
  headerClassName?: string;
  /**
   * The tabs of the layout.
   */
  tabs?: ReactNode;
  /**
   * The height of the tabs.
   */
  tabsHeight?: number;
  /**
   * The class of the tabs.
   */
  tabsClassName?: string;
  /**
   * The footer of the layout.
   */
  footer?: ReactNode;
  /**
   * The height of the footer.
   */
  footerHeight?: number;
  /**
   * The class of the footer.
   */
  footerClassName?: string;
  /**
   * The sidebar of the layout.
   */
  sidebar?: ReactNode;
  /**
   * The sidebar collapsed state.
   */
  isSidebarCollapsed?: boolean;
  /**
   * The width of the sidebar.
   */
  sidebarWidth?: number;
  /**
   * The collapsed width of the sidebar.
   */
  sidebarCollapsedWidth?: number;
  /**
   * The class of the sidebar.
   */
  sidebarClassName?: string;
  /**
   * Whether the sidebar sits below the header (mixed layout) instead of
   * spanning the full height. When enabled, the header stays full-width and the
   * sidebar starts at the header's bottom edge.
   */
  isSidebarBelowHeader?: boolean;
  /**
   * The main content maximum state.
   */
  isMainContentMaximum?: boolean;
}
