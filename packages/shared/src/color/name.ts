import type { HslaColor, RgbaColor } from "colord";

import { colorEntries, colorNameMap } from "../constants";
import { toHexColor, toHslColor, toRgbColor } from "./color-ops";

/**
 * Color distance calculation weights
 */
const COLOR_DISTANCE_WEIGHTS = {
  RGB: 1,
  HSL: 2
} as const;

/**
 * Get the closest matching color name for a given color
 *
 * @param color - The input color in any supported format (hex, rgb, hsl, etc.)
 * @returns The name of the closest matching color
 */
export function getColorName(color: string): string {
  const inputHex = toHexColor(color);

  // Try to find an exact match first
  const exactMatch = colorNameMap.get(inputHex as never);

  if (exactMatch) {
    return exactMatch;
  }

  // If no exact match, find the closest color by distance
  const inputRgb = toRgbColor(color);
  const inputHsl = toHslColor(color);

  let closestColorName = "Unknown";
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const [hexValue, colorName] of colorEntries) {
    const distance = calculateColorDistance(inputRgb, inputHsl, hexValue);

    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestColorName = colorName;
    }
  }

  return closestColorName;
}

/**
 * Calculate the distance between two RGB colors
 */
function calculateRgbDistance(rgb1: RgbaColor, rgb2: RgbaColor): number {
  return (rgb1.r - rgb2.r) ** 2 + (rgb1.g - rgb2.g) ** 2 + (rgb1.b - rgb2.b) ** 2;
}

/**
 * Calculate the distance between two HSL colors
 */
function calculateHslDistance(hsl1: HslaColor, hsl2: HslaColor): number {
  return (hsl1.h - hsl2.h) ** 2 + (hsl1.s - hsl2.s) ** 2 + (hsl1.l - hsl2.l) ** 2;
}

/**
 * Calculate the combined color distance using both RGB and HSL color spaces
 */
function calculateColorDistance(
  sourceRgb: RgbaColor,
  sourceHsl: HslaColor,
  targetHex: string
): number {
  const targetRgb = toRgbColor(targetHex);
  const targetHsl = toHslColor(targetHex);

  const rgbDistance = calculateRgbDistance(sourceRgb, targetRgb);
  const hslDistance = calculateHslDistance(sourceHsl, targetHsl);

  // Combine distances with weights (HSL weighted more heavily)
  return rgbDistance * COLOR_DISTANCE_WEIGHTS.RGB + hslDistance * COLOR_DISTANCE_WEIGHTS.HSL;
}
