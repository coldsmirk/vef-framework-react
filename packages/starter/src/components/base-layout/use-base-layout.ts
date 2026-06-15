import type { CSSProperties } from "react";

import type { BaseLayoutProps } from "./props";

import { isNullish } from "@vef-framework-react/shared";
import { useMemo } from "react";

interface UseBaseLayoutResult {
  isHeaderVisible: boolean;
  isTabsVisible: boolean;
  isSidebarVisible: boolean;
  isFooterVisible: boolean;
  cssVars: CSSProperties;
}

export function useBaseLayout({
  header,
  headerHeight = 56,
  tabs,
  tabsHeight = 44,
  footer,
  footerHeight = 48,
  sidebar,
  isSidebarCollapsed = false,
  sidebarWidth = 220,
  sidebarCollapsedWidth = 64,
  isMainContentMaximum = false
}: BaseLayoutProps): UseBaseLayoutResult {
  const isHeaderVisible = !isMainContentMaximum && !isNullish(header);
  const isTabsVisible = !isNullish(tabs);
  const isSidebarVisible = !isMainContentMaximum && !isNullish(sidebar);
  const isFooterVisible = !isMainContentMaximum && !isNullish(footer);

  const cssVars = useMemo<CSSProperties>(() => ({
    "--vef-layout-header-height": `${headerHeight}px`,
    "--vef-layout-tabs-height": `${tabsHeight}px`,
    "--vef-layout-sidebar-width": `${isSidebarCollapsed ? sidebarCollapsedWidth : sidebarWidth}px`,
    // The expanded width, unaffected by collapse — the full-width header's logo box uses it as a
    // min-width floor so the logo aligns with the expanded sidebar regardless of the collapse state.
    "--vef-layout-sidebar-expanded-width": `${sidebarWidth}px`,
    "--vef-layout-footer-height": `${footerHeight}px`
  } as CSSProperties), [headerHeight, tabsHeight, isSidebarCollapsed, sidebarCollapsedWidth, sidebarWidth, footerHeight]);

  return {
    isHeaderVisible,
    isTabsVisible,
    isSidebarVisible,
    isFooterVisible,
    cssVars
  };
}
