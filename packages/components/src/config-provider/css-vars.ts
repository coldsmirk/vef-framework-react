import type { LiteralUnion } from "@vef-framework-react/shared";

import type { PresetColor, SemanticColor } from "../_base";

import { colorPaletteMap, getColorPalette } from "@vef-framework-react/shared";

/**
 * Spacing CSS variables
 */
const spacingVars = {
  "--vef-spacing-xxs": "var(--vef-size-xxs, 4px)",
  "--vef-spacing-xs": "var(--vef-size-xs, 8px)",
  "--vef-spacing-sm": "var(--vef-size-sm, 12px)",
  "--vef-spacing-md": "var(--vef-size, 16px)",
  "--vef-spacing-lg": "var(--vef-size-md, 20px)",
  "--vef-spacing-xl": "var(--vef-size-lg, 24px)",
  "--vef-spacing-xxl": "var(--vef-size-xl, 32px)"
} as const;

/**
 * Shadow CSS variables
 */
const shadowVars = {
  "--vef-shadow-xxs": "0 1px 2px rgb(0 0 0 / 0.04)",
  "--vef-shadow-xs": "0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)",
  "--vef-shadow-sm": "0 2px 4px rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.06)",
  "--vef-shadow-md": "0 4px 8px -2px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)",
  "--vef-shadow-lg": "0 12px 24px -4px rgb(0 0 0 / 0.08), 0 4px 8px -2px rgb(0 0 0 / 0.04)",
  "--vef-shadow-xl": "0 20px 40px -8px rgb(0 0 0 / 0.1), 0 8px 16px -4px rgb(0 0 0 / 0.06)",
  "--vef-shadow-xxl": "0 32px 64px -12px rgb(0 0 0 / 0.14)",
  "--vef-shadow-glow": "0 0 20px rgb(99 102 241 / 0.15)",
  "--vef-shadow-card": "0 1px 3px rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.06)",
  "--vef-shadow-card-hover": "0 12px 24px -4px rgb(0 0 0 / 0.08), 0 4px 8px -2px rgb(0 0 0 / 0.04)"
} as const;

/**
 * Breakpoint CSS variables
 */
const breakpointVars = {
  "--vef-breakpoint-xs": "36em",
  "--vef-breakpoint-sm": "48em",
  "--vef-breakpoint-md": "62em",
  "--vef-breakpoint-lg": "75em",
  "--vef-breakpoint-xl": "88em"
} as const;

/**
 * Animation CSS variables and keyframes
 */
const animationVars = {
  "--vef-animate-spin": "spin 1s linear infinite",
  "--vef-animate-ping": "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
  "--vef-animate-pulse": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  "--vef-animate-bounce": "bounce 1s infinite",
  "@keyframes spin": {
    to: { transform: "rotate(360deg)" }
  },
  "@keyframes ping": {
    "75%, 100%": { transform: "scale(2)", opacity: 0 }
  },
  "@keyframes pulse": {
    "50%": { opacity: 0.5 }
  },
  "@keyframes bounce": {
    "0%, 100%": {
      transform: "translateY(-25%)",
      animationTimingFunction: "cubic-bezier(0.8, 0, 1, 1)"
    },
    "50%": {
      transform: "none",
      animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)"
    }
  }
};

/**
 * Build color CSS variables from semantic colors
 */
export function buildColorCssVars(
  colors: Record<SemanticColor, LiteralUnion<PresetColor, string>>
): Record<string, unknown> {
  const vars: Record<string, unknown> = {
    "--vef-color-inverted": "#0f172a",
    ...spacingVars,
    ...shadowVars,
    ...breakpointVars,
    ...animationVars
  };

  // Generate semantic color palettes
  for (const [key, color] of Object.entries(colors)) {
    const palette = getColorPalette(color);

    for (const [number, value] of palette.entries()) {
      vars[`--vef-color-${key}-${number}`] = value;
    }
  }

  // Generate preset color palettes
  for (const [key, colorMap] of colorPaletteMap.entries()) {
    for (const [number, value] of colorMap.entries()) {
      vars[`--vef-color-${key}-${number}`] = value;
    }
  }

  return vars;
}
