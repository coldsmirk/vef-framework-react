import type { LiteralUnion } from "@vef-framework-react/shared";
import type { PropsWithChildren } from "react";

import type { PresetColor, SemanticColor } from "../_base";
import type { ComponentDefaults } from "./component-defaults";

/**
 * The theme config
 */
export interface ThemeConfig {
  /**
   * The dark mode
   */
  isDarkMode?: boolean;
  /**
   * The colors config
   */
  colors?: Partial<Record<SemanticColor, LiteralUnion<PresetColor, string>>>;
}

/**
 * The props for the ConfigProvider component.
 */
export interface ConfigProviderProps extends PropsWithChildren {
  /**
   * The theme config
   */
  theme?: ThemeConfig;
  /**
   * Application-wide default props for framework components. Only the props the
   * framework whitelists per component are honored; see `ComponentDefaults`.
   */
  components?: ComponentDefaults;
}
