import type { HslaColor } from "colord";

import type {
  ColorNumber,
  ColorPalette,
  ColorSwatch,
  ColorSwatchWithDelta,
  MatchedColorPalette,
  NearestColorPalette
} from "../types";

import { lru } from "tiny-lru";

import { colorPalettes } from "../constants";
import { convertHslToHex, getColorDifference, isValidColor, toHslColor } from "./color-ops";
import { getColorName } from "./name";

/**
 * Color calculation constants
 * The main color is typically at position 500
 */
const MAIN_COLOR_NUMBER = 500;

/**
 * Cache for color palette
 */
const CACHE = lru<Map<ColorNumber, string>>(100);

/**
 * Get color palette from cache or generate it
 *
 * @param color - The color to get the palette for
 * @returns A map of color numbers to hex values
 */
export function getColorPalette(color: string): Map<ColorNumber, string> {
  if (CACHE.has(color)) {
    return CACHE.get(color)!;
  }

  const { colorMap } = generateMatchedColorPalette(color);
  CACHE.set(color, colorMap);
  return colorMap;
}

/**
 * Calculate a matched color palette based on the provided color
 *
 * This function generates a complete color palette that matches the input color,
 * including finding the main color (500), the exact match, and creating a color map.
 *
 * @param inputColor - The color to generate a palette for (in any supported format)
 * @returns A complete matched color palette with main color, matched swatch, and color map
 * @throws Error if the input color is invalid
 */
function generateMatchedColorPalette(inputColor: string): MatchedColorPalette {
  const basePalette = generateColorPalette(inputColor);

  const colorMap = new Map(basePalette.swatches.map(swatch => [swatch.number, swatch.hex]));
  const mainColorSwatch = basePalette.swatches.find(swatch => swatch.number === MAIN_COLOR_NUMBER);

  if (!mainColorSwatch) {
    throw new Error(`Main color swatch (${MAIN_COLOR_NUMBER}) not found in palette`);
  }

  const matchedColorSwatch = basePalette.swatches.find(swatch => swatch.hex === inputColor);

  if (!matchedColorSwatch) {
    throw new Error("Matched color swatch not found in generated palette");
  }

  return {
    ...basePalette,
    colorMap,
    main: mainColorSwatch,
    matched: matchedColorSwatch
  };
}

/**
 * Generate a color palette family based on a provided color
 *
 * This function creates a complete color palette by finding the nearest existing palette
 * and adjusting it to match the provided color's hue and saturation characteristics.
 *
 * @param inputColor - The color to base the palette on (in any supported format)
 * @returns A color palette with swatches ranging from light to dark
 * @throws Error if the input color is invalid
 */
function generateColorPalette(inputColor: string): ColorPalette {
  if (!isValidColor(inputColor)) {
    throw new Error(`Invalid color format: "${inputColor}". Please provide a valid color value.`);
  }

  // Generate a normalized color name
  const normalizedColorName = normalizeColorName(getColorName(inputColor));

  // Get the HSL values of the input color
  const inputHsl = toHslColor(inputColor);

  // Find the nearest color palette and lightness reference
  const nearestPaletteData = findNearestColorPalette(inputColor, colorPalettes);
  const { nearestLightnessSwatch, swatches: referencePalette } = nearestPaletteData;

  // Calculate the adjustments needed based on the nearest lightness swatch
  const adjustments = calculateColorAdjustments(inputHsl, nearestLightnessSwatch);

  // Generate the new palette by applying adjustments to each swatch
  const adjustedSwatches = referencePalette.map(referenceSwatch => {
    // Use the original input color for the exact match
    if (nearestLightnessSwatch.number === referenceSwatch.number) {
      return {
        hex: inputColor,
        number: referenceSwatch.number
      };
    }

    // Apply adjustments to create the new swatch
    return {
      hex: applyColorAdjustments(referenceSwatch.hex, adjustments),
      number: referenceSwatch.number
    };
  });

  return {
    name: normalizedColorName,
    swatches: adjustedSwatches
  };
}

/**
 * Normalize a color name for consistent formatting
 *
 * @param colorName - The raw color name to normalize
 * @returns A normalized color name (lowercase, spaces replaced with hyphens)
 */
function normalizeColorName(colorName: string): string {
  return colorName.toLowerCase().replaceAll(/\s+/g, "-");
}

/**
 * Calculate the adjustments needed to transform a reference palette to match the input color
 *
 * @param inputHsl - The HSL values of the input color
 * @param referenceSwatch - The reference swatch to calculate adjustments from
 * @returns An object containing hue delta and saturation ratio adjustments
 */
function calculateColorAdjustments(
  inputHsl: HslaColor,
  referenceSwatch: ColorSwatch
): { hueDelta: number; saturationRatio: number } {
  const referenceHsl = toHslColor(referenceSwatch.hex);

  return {
    hueDelta: inputHsl.h - referenceHsl.h,
    saturationRatio: referenceHsl.s > 0 ? inputHsl.s / referenceHsl.s : 1
  };
}

/**
 * Apply color adjustments to a reference color
 *
 * @param referenceHex - The reference color in hex format
 * @param adjustments - The adjustments to apply (hue delta and saturation ratio)
 * @param adjustments.hueDelta - The hue delta
 * @param adjustments.saturationRatio - The saturation ratio
 * @returns The adjusted color in hex format
 */
function applyColorAdjustments(
  referenceHex: string,
  adjustments: { hueDelta: number; saturationRatio: number }
): string {
  const {
    h: referenceHue,
    s: referenceSaturation,
    l: referenceLightness
  } = toHslColor(referenceHex);

  const adjustedHue = referenceHue + adjustments.hueDelta;
  const adjustedSaturation = referenceSaturation * adjustments.saturationRatio;

  return convertHslToHex({
    h: adjustedHue,
    s: adjustedSaturation,
    l: referenceLightness
  });
}

/**
 * Find the nearest color palette from available palettes
 *
 * This function finds the palette that contains the color most similar to the input color,
 * and also identifies the swatch with the closest lightness value.
 *
 * @param inputColor - The color to find the nearest palette for
 * @param availablePalettes - Array of available color palettes to search through
 * @returns The nearest color palette with additional metadata about the closest swatches
 */
function findNearestColorPalette(
  inputColor: string,
  availablePalettes: readonly ColorPalette[]
): NearestColorPalette {
  // Calculate color differences for all palettes
  const palettesWithDistances = availablePalettes.map(palette => {
    const swatchesWithDistances = palette.swatches.map(swatch => ({
      ...swatch,
      delta: getColorDifference(inputColor, swatch.hex)
    } satisfies ColorSwatchWithDelta));

    // Find the swatch with minimum color difference
    const nearestSwatch = swatchesWithDistances.reduce((closest, current) => current.delta < closest.delta ? current : closest);

    return {
      ...palette,
      swatches: swatchesWithDistances,
      nearestSwatch
    };
  });

  // Find the palette with the overall nearest swatch
  const nearestPalette = palettesWithDistances.reduce((closest, current) => current.nearestSwatch.delta < closest.nearestSwatch.delta ? current : closest);

  // Find the swatch with the closest lightness value
  const inputLightness = toHslColor(inputColor).l;

  const nearestLightnessSwatch = nearestPalette.swatches.reduce((closest, current) => {
    const closestLightnessDelta = Math.abs(toHslColor(closest.hex).l - inputLightness);
    const currentLightnessDelta = Math.abs(toHslColor(current.hex).l - inputLightness);

    return currentLightnessDelta < closestLightnessDelta ? current : closest;
  });

  return {
    ...nearestPalette,
    nearestLightnessSwatch
  };
}
