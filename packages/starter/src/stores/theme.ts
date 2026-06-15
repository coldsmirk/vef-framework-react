import type { Orientation, SemanticColor } from "@vef-framework-react/components";

import { createPersistedStore } from "@vef-framework-react/core";
import { omit } from "@vef-framework-react/shared";

export type ColorScheme = "system" | "light" | "dark";
export type ThemeColors = Record<SemanticColor, string>;

/**
 * The menu layout mode.
 *
 * - `vertical`: menu lives in the left sidebar.
 * - `horizontal`: menu lives in the top header.
 * - `mixed`: first-level menu in the top header, its children in the left sidebar.
 */
export type MenuLayoutMode = Orientation | "mixed";

export interface ThemeState {
  isThemeConfigVisible: boolean;
  colorScheme: ColorScheme;
  colors: ThemeColors;
  isGrayscaleMode: boolean;
  isColorBlindMode: boolean;
  isMenuAccordionMode: boolean;
  menuLayout: MenuLayoutMode;
  isTabsVisible: boolean;
  /**
   * Render the sidebar as a dark brand surface. Only takes effect in the
   * `vertical` menu layout; other layouts keep the light sidebar.
   */
  isDarkSidebar: boolean;
  isSidebarCollapsed: boolean;
  isMainContentMaximum: boolean;
}

const DEFAULT_THEME_STATE: Omit<ThemeState, "isThemeConfigVisible"> = {
  colorScheme: "system",
  colors: {
    primary: "#155dfc",
    success: "#00c951",
    info: "#00a6f4",
    warning: "#ff6900",
    error: "#fb2c36"
  },
  isGrayscaleMode: false,
  isColorBlindMode: false,
  isMenuAccordionMode: true,
  menuLayout: "vertical",
  isTabsVisible: true,
  isDarkSidebar: true,
  isSidebarCollapsed: false,
  isMainContentMaximum: false
};

export const useThemeStore = createPersistedStore<ThemeState>(
  () => {
    return {
      isThemeConfigVisible: false,
      ...DEFAULT_THEME_STATE
    };
  },
  {
    name: "theme",
    storage: "local",
    selector: state => omit(state, ["isThemeConfigVisible"])
  }
);
