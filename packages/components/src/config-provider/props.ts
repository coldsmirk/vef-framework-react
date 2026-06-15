import type { CSSInterpolation } from "@emotion/serialize";
import type { LiteralUnion } from "@vef-framework-react/shared";
import type { PropsWithChildren } from "react";

import type { PresetColor, SemanticColor } from "../_base";

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
  /**
   * The global css variables
   */
  globalCssVars?: Record<`--vef-${string}`, string | number>;
  /**
   * The global style
   */
  globalStyle?: CSSInterpolation;
}

/**
 * The props for the ConfigProvider component.
 */
export interface ConfigProviderProps extends PropsWithChildren {
  /**
   * The theme config
   */
  theme?: ThemeConfig;
}
