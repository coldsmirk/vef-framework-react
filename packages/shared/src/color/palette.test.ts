import { describe, expect, it } from "vitest";

import { getColorPalette, isValidColor } from "..";

describe("color/palette", () => {
  describe("getColorPalette", () => {
    it("generates a color palette for basic colors", () => {
      const redPalette = getColorPalette("#ff0000");

      // Should return a Map with ColorNumber keys
      expect(redPalette).toBeInstanceOf(Map);
      expect(redPalette.size).toBeGreaterThan(0);

      // Should have standard palette numbers
      const expectedNumbers = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

      for (const number of expectedNumbers) {
        expect(redPalette.has(number)).toBe(true);
      }

      // All values should be valid hex colors
      for (const [number, hex] of redPalette) {
        expect(expectedNumbers).toContain(number);
        expect(hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(isValidColor(hex)).toBe(true);
      }
    });

    it("generates different palettes for different colors", () => {
      const redPalette = getColorPalette("#ff0000");
      const bluePalette = getColorPalette("#0000ff");
      const greenPalette = getColorPalette("#00ff00");

      // Palettes should be different
      expect(redPalette.get(500)).not.toBe(bluePalette.get(500));
      expect(redPalette.get(500)).not.toBe(greenPalette.get(500));
      expect(bluePalette.get(500)).not.toBe(greenPalette.get(500));

      // But should have the same structure
      expect(redPalette.size).toBe(bluePalette.size);
      expect(bluePalette.size).toBe(greenPalette.size);
    });

    it("handles different color formats", () => {
      const hexPalette = getColorPalette("#ff6600");
      const rgbPalette = getColorPalette("rgb(255, 102, 0)");
      const hslPalette = getColorPalette("hsl(24, 100%, 50%)");
      const namedPalette = getColorPalette("orange");

      // All should produce valid palettes
      expect(hexPalette).toBeInstanceOf(Map);
      expect(rgbPalette).toBeInstanceOf(Map);
      expect(hslPalette).toBeInstanceOf(Map);
      expect(namedPalette).toBeInstanceOf(Map);

      // All should have the same size
      expect(hexPalette.size).toBe(rgbPalette.size);
      expect(rgbPalette.size).toBe(hslPalette.size);
      expect(hslPalette.size).toBe(namedPalette.size);
    });

    it("creates logical color progression from light to dark", () => {
      // Blue-500-ish color
      const palette = getColorPalette("#3b82f6");

      // Get lightness values for different swatches
      const swatches = [
        {
          number: 50,
          hex: palette.get(50)!
        },
        {
          number: 200,
          hex: palette.get(200)!
        },
        {
          number: 500,
          hex: palette.get(500)!
        },
        {
          number: 800,
          hex: palette.get(800)!
        },
        {
          number: 950,
          hex: palette.get(950)!
        }
      ];

      // Convert to RGB to check if they follow a logical progression
      const rgbValues = swatches.map(swatch => {
        const { hex } = swatch;
        const r = Number.parseInt(hex.slice(1, 3), 16);
        const g = Number.parseInt(hex.slice(3, 5), 16);
        const b = Number.parseInt(hex.slice(5, 7), 16);
        return {
          ...swatch,
          brightness: (r + g + b) / 3
        };
      });

      // Should generally get darker as numbers increase
      // 50 > 200
      expect(rgbValues[0]!.brightness).toBeGreaterThan(rgbValues[1]!.brightness);
      // 200 > 500
      expect(rgbValues[1]!.brightness).toBeGreaterThan(rgbValues[2]!.brightness);
      // 500 > 800
      expect(rgbValues[2]!.brightness).toBeGreaterThan(rgbValues[3]!.brightness);
      // 800 > 950
      expect(rgbValues[3]!.brightness).toBeGreaterThan(rgbValues[4]!.brightness);
    });

    it("maintains hue consistency across palette", () => {
      // Orange
      const palette = getColorPalette("#ff6600");

      // Sample a few swatches from the palette
      const sampleSwatches = ([200, 500, 800] as const).map(number => palette.get(number)!);

      // All should be valid colors
      for (const hex of sampleSwatches) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(isValidColor(hex)).toBe(true);
      }

      // They should maintain similar hue characteristics (hard to test precisely,
      // but we can verify they're all valid and different)
      const uniqueColors = new Set(sampleSwatches);
      expect(uniqueColors.size).toBe(sampleSwatches.length);
    });

    it("uses caching for performance", () => {
      const color = "#ff6600";

      // First call
      const startTime1 = Date.now();
      const palette1 = getColorPalette(color);
      const duration1 = Date.now() - startTime1;

      // Second call (should be cached)
      const startTime2 = Date.now();
      const palette2 = getColorPalette(color);
      const duration2 = Date.now() - startTime2;

      // Should return the same palette
      // Same reference due to caching
      expect(palette1).toBe(palette2);

      // Second call should be faster (cached)
      expect(duration2).toBeLessThanOrEqual(duration1);

      // Both should have same content
      expect(palette1.size).toBe(palette2.size);

      for (const [number, hex] of palette1) {
        expect(palette2.get(number)).toBe(hex);
      }
    });

    it("handles edge case colors", () => {
      const testColors = [
        // Pure black
        "#000000",
        // Pure white
        "#ffffff",
        // Gray
        "#808080",
        // Pure red
        "#ff0000",
        // Pure green
        "#00ff00",
        // Pure blue
        "#0000ff",
        // Yellow
        "#ffff00",
        // Magenta
        "#ff00ff",
        // Cyan
        "#00ffff"
      ];

      for (const color of testColors) {
        const palette = getColorPalette(color);

        // Should produce valid palette
        expect(palette).toBeInstanceOf(Map);
        expect(palette.size).toBeGreaterThan(0);

        // Should have 500 key (main color)
        expect(palette.has(500)).toBe(true);

        // All values should be valid hex colors
        for (const [, hex] of palette) {
          expect(hex).toMatch(/^#[0-9a-f]{6}$/);
          expect(isValidColor(hex)).toBe(true);
        }
      }
    });

    it("handles different brightness input colors", () => {
      // Very dark red
      const darkColor = "#330000";
      // Very light red
      const brightColor = "#ffcccc";
      // Medium red
      const mediumColor = "#cc6666";

      const darkPalette = getColorPalette(darkColor);
      const brightPalette = getColorPalette(brightColor);
      const mediumPalette = getColorPalette(mediumColor);

      // All should produce valid palettes
      expect(darkPalette).toBeInstanceOf(Map);
      expect(brightPalette).toBeInstanceOf(Map);
      expect(mediumPalette).toBeInstanceOf(Map);

      // Should have same structure
      expect(darkPalette.size).toBe(brightPalette.size);
      expect(brightPalette.size).toBe(mediumPalette.size);

      // Should produce different palettes
      expect(darkPalette.get(500)).not.toBe(brightPalette.get(500));
      expect(brightPalette.get(500)).not.toBe(mediumPalette.get(500));
    });

    it("handles named CSS colors", () => {
      const namedColors = [
        "red",
        "blue",
        "green",
        "orange",
        "purple",
        "yellow",
        "pink",
        "brown",
        "gray",
        "black",
        "white"
      ];

      for (const colorName of namedColors) {
        const palette = getColorPalette(colorName);

        // Should produce valid palette
        expect(palette).toBeInstanceOf(Map);
        expect(palette.size).toBeGreaterThan(0);

        // Should have standard numbers
        expect(palette.has(500)).toBe(true);
        expect(palette.has(50)).toBe(true);
        expect(palette.has(950)).toBe(true);

        // All colors should be valid
        for (const [, hex] of palette) {
          expect(isValidColor(hex)).toBe(true);
        }
      }
    });

    it("throws error for invalid colors", () => {
      const invalidColors = [
        "not-a-color",
        "#gggggg",
        "",
        " ".repeat(3),
        "#",
        "#12345",
        "#1234567"
      ];

      for (const invalidColor of invalidColors) {
        expect(() => getColorPalette(invalidColor)).toThrow();
      }
    });

    it("maintains consistent palette structure", () => {
      const testColors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00"];
      const expectedNumbers = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

      for (const color of testColors) {
        const palette = getColorPalette(color);

        // Should have exactly the expected numbers
        expect(palette.size).toBe(expectedNumbers.length);

        // Should have all expected numbers
        for (const number of expectedNumbers) {
          expect(palette.has(number)).toBe(true);
          expect(palette.get(number)).toMatch(/^#[0-9a-f]{6}$/);
        }

        // Should not have any unexpected numbers
        for (const [number] of palette) {
          expect(expectedNumbers).toContain(number);
        }
      }
    });

    it("handles HSL colors correctly", () => {
      const hslColors = [
        // Red
        "hsl(0, 100%, 50%)",
        // Green
        "hsl(120, 100%, 50%)",
        // Blue
        "hsl(240, 100%, 50%)",
        // Yellow
        "hsl(60, 100%, 50%)",
        // Magenta
        "hsl(300, 100%, 50%)",
        // Cyan
        "hsl(180, 100%, 50%)",
        // Gray
        "hsl(0, 0%, 50%)"
      ];

      for (const hslColor of hslColors) {
        const palette = getColorPalette(hslColor);

        // Should produce valid palette
        expect(palette).toBeInstanceOf(Map);
        // Standard palette size
        expect(palette.size).toBe(11);

        // All values should be valid colors (may include original format)
        for (const [, colorValue] of palette) {
          expect(isValidColor(colorValue)).toBe(true);
        }
      }
    });

    it("handles RGBA colors correctly", () => {
      const rgbaColors = [
        "rgba(255, 0, 0, 1)",
        "rgba(0, 255, 0, 0.8)",
        "rgba(0, 0, 255, 0.5)",
        "rgba(255, 255, 0, 0.3)"
      ];

      for (const rgbaColor of rgbaColors) {
        const palette = getColorPalette(rgbaColor);

        // Should produce valid palette
        expect(palette).toBeInstanceOf(Map);
        expect(palette.size).toBeGreaterThan(0);

        // All values should be valid colors (alpha is ignored for palette generation)
        for (const [, colorValue] of palette) {
          expect(isValidColor(colorValue)).toBe(true);
        }
      }
    });
  });

  describe("palette consistency and quality", () => {
    it("produces palettes with good color distribution", () => {
      // A nice blue
      const testColor = "#3b82f6";
      const palette = getColorPalette(testColor);

      // Get all hex values
      const hexValues = palette.values().toArray();

      // Should have no duplicate colors
      const uniqueColors = new Set(hexValues);
      expect(uniqueColors.size).toBe(hexValues.length);

      // Should have variety in colors (not all the same)
      expect(uniqueColors.size).toBeGreaterThan(1);
    });

    it("handles performance with multiple different colors", () => {
      const colors = [
        "#ff0000",
        "#00ff00",
        "#0000ff",
        "#ffff00",
        "#ff00ff",
        "#00ffff",
        "#800000",
        "#008000",
        "#000080",
        "#808000",
        "#800080",
        "#008080",
        "#ff8000",
        "#8000ff",
        "#0080ff",
        "#ff0080",
        "#80ff00",
        "#0080ff"
      ];

      const startTime = Date.now();

      const palettes = colors.map(color => getColorPalette(color));

      const duration = Date.now() - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000);

      // All should be valid palettes
      for (const palette of palettes) {
        expect(palette).toBeInstanceOf(Map);
        expect(palette.size).toBeGreaterThan(0);
      }
    });

    it("maintains color relationships in complex scenarios", () => {
      // Test with colors that might be edge cases for palette generation
      const complexColors = [
        // Very dark
        "#191919",
        // Very light
        "#f0f0f0",
        // Neutral gray
        "#808080",
        // Deep pink
        "#ff1493",
        // Lime green
        "#32cd32",
        // Royal blue
        "#4169e1"
      ];

      for (const color of complexColors) {
        const palette = getColorPalette(color);

        // Should have complete palette
        expect(palette.size).toBe(11);

        // Should maintain logical brightness progression
        const brightness50 = getBrightness(palette.get(50)!);
        const brightness500 = getBrightness(palette.get(500)!);
        const brightness950 = getBrightness(palette.get(950)!);

        // Generally, 50 should be lighter than 500, and 500 lighter than 950
        expect(brightness50).toBeGreaterThanOrEqual(brightness500);
        expect(brightness500).toBeGreaterThanOrEqual(brightness950);
      }
    });
  });
});

// Helper function to calculate brightness of a hex color
function getBrightness(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  // Using standard luminance formula
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
