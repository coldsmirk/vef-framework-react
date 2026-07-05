import type { AnyColor, HslaColor, HslColor, HsvaColor, RgbaColor, RgbColor } from "colord";

import { colord, extend } from "colord";
import labPlugin from "colord/plugins/lab";
import mixPlugin from "colord/plugins/mix";
import namesPlugin from "colord/plugins/names";

const WHITE_COLOR = "#ffffff";
let colorPluginsConfigured = false;

function ensureColorPluginsConfigured(): void {
  if (colorPluginsConfigured) {
    return;
  }

  extend([namesPlugin, mixPlugin, labPlugin]);
  colorPluginsConfigured = true;
}

function createColor(color: AnyColor) {
  ensureColorPluginsConfigured();
  return colord(color);
}

/**
 * Check if the given color is valid
 *
 * @param color - The color to validate in any supported format
 * @returns True if the color is valid, false otherwise
 */
export function isValidColor(color: AnyColor): boolean {
  return createColor(color).isValid();
}

/**
 * Convert color to hexadecimal format
 *
 * @param color - The color to convert in any supported format
 * @returns The color in hexadecimal format (e.g., "#ff0000")
 */
export function toHexColor(color: AnyColor): string {
  return createColor(color).toHex();
}

/**
 * Convert color to RGB format
 *
 * @param color - The color to convert in any supported format
 * @returns The color in RGBA format with r, g, b, a properties
 */
export function toRgbColor(color: AnyColor): RgbaColor {
  return createColor(color).toRgb();
}

/**
 * Convert color to HSL format
 *
 * @param color - The color to convert in any supported format
 * @returns The color in HSLA format with h, s, l, a properties
 */
export function toHslColor(color: AnyColor): HslaColor {
  return createColor(color).toHsl();
}

/**
 * Convert color to HSV format
 *
 * @param color - The color to convert in any supported format
 * @returns The color in HSVA format with h, s, v, a properties
 */
export function toHsvColor(color: AnyColor): HsvaColor {
  return createColor(color).toHsv();
}

/**
 * Calculate the Delta E color difference between two colors
 *
 * @param firstColor - The first color for comparison
 * @param secondColor - The second color for comparison
 * @returns The Delta E value (lower values indicate more similar colors)
 */
export function getColorDifference(firstColor: AnyColor, secondColor: AnyColor): number {
  return createColor(firstColor).delta(secondColor);
}

/**
 * Convert HSL color object to hexadecimal format
 *
 * @param hslColor - The HSL color object to convert
 * @returns The color in hexadecimal format
 */
export function convertHslToHex(hslColor: HslColor): string {
  return createColor(hslColor).toHex();
}

/**
 * Set the alpha (opacity) value of a color
 *
 * @param color - The base color in any supported format
 * @param alphaValue - The alpha value (0 = transparent, 1 = opaque)
 * @returns The color with the specified alpha value in hexadecimal format
 */
export function setColorAlpha(color: AnyColor, alphaValue: number): string {
  return createColor(color).alpha(alphaValue).toHex();
}

/**
 * Mix two colors together with a specified ratio
 *
 * @param baseColor - The base color to mix from
 * @param blendColor - The color to mix into the base color
 * @param blendRatio - The ratio of the blend color (0 = pure base color, 1 = pure blend color)
 * @returns The mixed color in hexadecimal format
 */
export function mixColor(baseColor: AnyColor, blendColor: AnyColor, blendRatio: number): string {
  return createColor(baseColor).mix(blendColor, blendRatio).toHex();
}

/**
 * Convert a transparent color to an opaque color by blending with background
 *
 * @param color - The color to convert
 * @param alphaValue - The alpha value (0 = transparent, 1 = opaque)
 * @param backgroundColor - The background color to blend with (defaults to white)
 * @returns The opaque color that visually matches the transparent color over the background
 */
export function convertTransparentToOpaque(
  color: AnyColor,
  alphaValue: number,
  backgroundColor = WHITE_COLOR
): string {
  const transparentColor = setColorAlpha(color, alphaValue);
  const foreground = createColor(transparentColor).toRgb();
  const background = createColor(backgroundColor).toRgb();

  const resultRgb: RgbColor = {
    r: calculateRgbComponent(foreground.r, background.r, alphaValue),
    g: calculateRgbComponent(foreground.g, background.g, alphaValue),
    b: calculateRgbComponent(foreground.b, background.b, alphaValue)
  };

  return createColor(resultRgb).toHex();
}

/**
 * Check if the given color is white
 *
 * @param color - The color to check in any supported format
 * @returns True if the color is white, false otherwise
 */
export function isWhiteColor(color: AnyColor): boolean {
  return createColor(color).isEqual(WHITE_COLOR);
}

/**
 * Calculate RGB component value for opacity simulation
 */
function calculateRgbComponent(foregroundValue: number, backgroundValue: number, alphaValue: number): number {
  return backgroundValue + (foregroundValue - backgroundValue) * alphaValue;
}
