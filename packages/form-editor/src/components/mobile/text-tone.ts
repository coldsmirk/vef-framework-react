import type { TextTone } from "../../types";

import { globalCssVars } from "@vef-framework-react/components";

/**
 * The theme color of each semantic text tone, approximating the PC
 * `Typography` `type` palette. An absent tone leaves the renderer's base color.
 */
export const textToneColors: Record<TextTone, string> = {
  secondary: globalCssVars.colorTextSecondary,
  success: globalCssVars.colorSuccess,
  warning: globalCssVars.colorWarning,
  danger: globalCssVars.colorError
};
