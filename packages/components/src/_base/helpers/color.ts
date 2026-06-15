import type { PresetColor, SemanticColor } from "../types";

import { presetColors, semanticColors } from "../constants/common";

export function isPresetColor(color: string): color is PresetColor {
  return presetColors.includes(color as PresetColor);
}

export function isSemanticColor(color: string): color is SemanticColor {
  return semanticColors.includes(color as SemanticColor);
}
