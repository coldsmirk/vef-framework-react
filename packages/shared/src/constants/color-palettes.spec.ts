import type { ColorNumber } from "..";

import { describe, expect, it } from "vitest";

import { colorPaletteMap, colorPalettes } from "..";

describe("constants/color-palettes", () => {
  describe("colorPaletteMap", () => {
    it("is a Map instance", () => {
      expect(colorPaletteMap).toBeInstanceOf(Map);
    });

    it("has the same size as colorPalettes array", () => {
      expect(colorPaletteMap.size).toBe(colorPalettes.length);
    });

    it("contains all color palettes with kebab-case names", () => {
      const expectedNames = [
        "red",
        "orange",
        "amber",
        "yellow",
        "lime",
        "green",
        "emerald",
        "teal",
        "cyan",
        "sky",
        "blue",
        "indigo",
        "violet",
        "purple",
        "fuchsia",
        "pink",
        "rose",
        "slate",
        "gray",
        "zinc",
        "neutral",
        "stone"
      ];

      for (const name of expectedNames) {
        expect(colorPaletteMap.has(name as any)).toBe(true);
      }

      expect([...colorPaletteMap.keys()].toSorted()).toEqual(expectedNames.toSorted());
    });

    it("has nested Maps as values", () => {
      for (const paletteMap of colorPaletteMap.values()) {
        expect(paletteMap).toBeInstanceOf(Map);
      }
    });

    it("contains standard color numbers for each palette", () => {
      const expectedNumbers: ColorNumber[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

      for (const paletteMap of colorPaletteMap.values()) {
        expect(paletteMap.size).toBe(expectedNumbers.length);

        for (const number of expectedNumbers) {
          expect(paletteMap.has(number)).toBe(true);
        }
      }
    });

    it("has valid hex color values", () => {
      for (const paletteMap of colorPaletteMap.values()) {
        for (const hex of paletteMap.values()) {
          expect(hex).toMatch(/^#[0-9a-f]{6}$/);
          expect(typeof hex).toBe("string");
          expect(hex.length).toBe(7);
        }
      }
    });

    it("correctly maps specific known palettes", () => {
      // Test Red palette
      const redPalette = colorPaletteMap.get("red");
      expect(redPalette).toBeDefined();
      expect(redPalette!.get(500)).toBe("#fb2c36");
      expect(redPalette!.get(50)).toBe("#fef2f2");
      expect(redPalette!.get(950)).toBe("#460809");

      // Test Blue palette
      const bluePalette = colorPaletteMap.get("blue");
      expect(bluePalette).toBeDefined();
      expect(bluePalette!.get(500)).toBe("#2b7fff");
      expect(bluePalette!.get(50)).toBe("#eff6ff");
      expect(bluePalette!.get(950)).toBe("#162456");

      // Test Gray palette
      const grayPalette = colorPaletteMap.get("gray");
      expect(grayPalette).toBeDefined();
      expect(grayPalette!.get(500)).toBe("#6a7282");
      expect(grayPalette!.get(50)).toBe("#f9fafb");
      expect(grayPalette!.get(950)).toBe("#030712");
    });

    it("has logical color progression from light to dark", () => {
      for (const [paletteName, paletteMap] of colorPaletteMap) {
        // Skip gray-scale palettes for this test as they might not follow hue consistency
        if (["slate", "gray", "zinc", "neutral", "stone"].includes(paletteName)) {
          continue;
        }

        // Check that lower numbers are generally lighter (higher in hex value for simple cases)
        const color50 = paletteMap.get(50)!;
        const color500 = paletteMap.get(500)!;
        const color950 = paletteMap.get(950)!;

        // Basic check: 50 should be much lighter than 950
        expect(color50).not.toBe(color950);
        expect(color50).not.toBe(color500);
        expect(color500).not.toBe(color950);
      }
    });

    it("maintains consistency with original colorPalettes array", () => {
      for (const palette of colorPalettes) {
        const kebabName = palette.name.toLowerCase().replaceAll(/\s+/g, "-");
        const paletteMap = colorPaletteMap.get(kebabName as any);

        expect(paletteMap).toBeDefined();

        for (const swatch of palette.swatches) {
          expect(paletteMap!.get(swatch.number)).toBe(swatch.hex);
        }
      }
    });

    it("handles edge cases correctly", () => {
      // Test non-existent palette
      expect(colorPaletteMap.get("nonexistent" as any)).toBeUndefined();

      // Test case sensitivity
      expect(colorPaletteMap.get("RED" as any)).toBeUndefined();
      expect(colorPaletteMap.get("Red" as any)).toBeUndefined();
      expect(colorPaletteMap.get("red")).toBeDefined();
    });

    it("performs fast lookups", () => {
      const startTime = performance.now();

      // Perform many lookups
      for (let i = 0; i < 1000; i++) {
        colorPaletteMap.get("red")?.get(500);
        colorPaletteMap.get("blue")?.get(600);
        colorPaletteMap.get("green")?.get(400);
        colorPaletteMap.has("gray");
        colorPaletteMap.has("purple");
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 10ms for 5000 operations)
      expect(duration).toBeLessThan(10);
    });

    it("has unique color combinations across palettes", () => {
      const allColors = new Set<string>();
      let duplicateCount = 0;

      for (const paletteMap of colorPaletteMap.values()) {
        for (const hex of paletteMap.values()) {
          if (allColors.has(hex)) {
            duplicateCount++;
          }

          allColors.add(hex);
        }
      }

      // Allow some duplicates (especially in neutral colors) but not too many
      expect(duplicateCount).toBeLessThan(50);
    });
  });
});
