import { describe, expect, it } from "vitest";

import { getColorName } from "..";

describe("color/name", () => {
  describe("getColorName", () => {
    it("returns exact color name for hex values", () => {
      // Test exact matches from colorEntries
      expect(getColorName("#000000")).toBe("Black");
      expect(getColorName("#ffffff")).toBe("White");
      expect(getColorName("#ff0000")).toBe("Red");
      expect(getColorName("#00ff00")).toBe("Green");
      expect(getColorName("#0000ff")).toBe("Blue");
      expect(getColorName("#008080")).toBe("Teal");
      expect(getColorName("#00ffff")).toBe("Cyan Aqua");
    });

    it("handles different hex formats", () => {
      // Test with and without hash prefix
      expect(getColorName("#000000")).toBe("Black");
      expect(getColorName("000000")).toBe("Black");

      // Test 3-character hex codes
      expect(getColorName("#000")).toBe("Black");
      expect(getColorName("#fff")).toBe("White");
      expect(getColorName("#f00")).toBe("Red");
    });

    it("handles RGB color format", () => {
      // Test RGB values that match known colors
      expect(getColorName("rgb(0, 0, 0)")).toBe("Black");
      expect(getColorName("rgb(255, 255, 255)")).toBe("White");
      expect(getColorName("rgb(255, 0, 0)")).toBe("Red");
      expect(getColorName("rgb(0, 255, 0)")).toBe("Green");
      expect(getColorName("rgb(0, 0, 255)")).toBe("Blue");
    });

    it("handles RGBA color format", () => {
      // Test RGBA values (alpha should not affect name matching)
      expect(getColorName("rgba(0, 0, 0, 1)")).toBe("Black");
      expect(getColorName("rgba(255, 255, 255, 0.5)")).toBe("White");
      expect(getColorName("rgba(255, 0, 0, 0.8)")).toBe("Red");
    });

    it("handles HSL color format", () => {
      // Test HSL values that match known colors
      expect(getColorName("hsl(0, 0%, 0%)")).toBe("Black");
      expect(getColorName("hsl(0, 0%, 100%)")).toBe("White");
      expect(getColorName("hsl(0, 100%, 50%)")).toBe("Red");
      expect(getColorName("hsl(120, 100%, 50%)")).toBe("Green");
      expect(getColorName("hsl(240, 100%, 50%)")).toBe("Blue");
    });

    it("handles HSLA color format", () => {
      // Test HSLA values (alpha should not affect name matching)
      expect(getColorName("hsla(0, 0%, 0%, 1)")).toBe("Black");
      expect(getColorName("hsla(0, 100%, 50%, 0.7)")).toBe("Red");
    });

    it("finds closest match for non-exact colors", () => {
      // Test colors that are close to known colors
      // Very close to black
      expect(getColorName("#010101")).toBe("Black");
      // Very close to white
      expect(getColorName("#fefefe")).toBe("White");
      // Very close to red
      expect(getColorName("#fe0000")).toBe("Red");

      // Test some intermediate colors
      // Should return some gray-like color
      expect(getColorName("#808080")).toBeTypeOf("string");
      // Should return some dark red color
      expect(getColorName("#800000")).toBeTypeOf("string");
    });

    it("handles case-insensitive color names", () => {
      // Test named colors
      expect(getColorName("black")).toBe("Black");
      expect(getColorName("WHITE")).toBe("White");
      expect(getColorName("Red")).toBe("Red");
      expect(getColorName("blue")).toBe("Blue");
    });

    it("returns consistent results for same color in different formats", () => {
      // Test that different representations of the same color return the same name
      const redHex = getColorName("#ff0000");
      const redRgb = getColorName("rgb(255, 0, 0)");
      const redHsl = getColorName("hsl(0, 100%, 50%)");
      const redNamed = getColorName("red");

      expect(redHex).toBe(redRgb);
      expect(redRgb).toBe(redHsl);
      expect(redHsl).toBe(redNamed);
      expect(redHex).toBe("Red");
    });

    it("handles edge cases gracefully", () => {
      // Test invalid or edge case inputs
      const invalidColor = getColorName("invalid-color");
      expect(invalidColor).toBeTypeOf("string");
      expect(invalidColor.length).toBeGreaterThan(0);

      // Test empty string
      const emptyColor = getColorName("");
      expect(emptyColor).toBeTypeOf("string");
      expect(emptyColor.length).toBeGreaterThan(0);
    });

    it("always returns a valid color name", () => {
      // Test that function never returns empty string or undefined
      const testColors = [
        "#123456",
        "#abcdef",
        "#987654",
        "rgb(123, 45, 67)",
        "hsl(180, 50%, 25%)",
        "transparent",
        // Invalid hex
        "#xyz"
      ];

      for (const color of testColors) {
        const result = getColorName(color);
        expect(result).toBeTypeOf("string");
        expect(result.length).toBeGreaterThan(0);
        expect(result).not.toBe("Unknown");
      }
    });

    it("handles transparency and alpha channels", () => {
      // Test that colors with transparency still get matched
      // Fully transparent black
      expect(getColorName("rgba(0, 0, 0, 0)")).toBe("Black");
      // Nearly transparent white
      expect(getColorName("rgba(255, 255, 255, 0.1)")).toBe("White");
      // Semi-transparent red
      expect(getColorName("hsla(0, 100%, 50%, 0.5)")).toBe("Red");
    });

    it("returns reasonable names for common web colors", () => {
      // Test some common web colors
      const commonColors = [
        // Dark gray
        "#333333",
        // Medium gray
        "#666666",
        // Light gray
        "#999999",
        // Very light gray
        "#cccccc",
        // Orange
        "#ff6600",
        // Purple
        "#663399",
        // Dark green
        "#006633"
      ];

      for (const color of commonColors) {
        const result = getColorName(color);
        expect(result).toBeTypeOf("string");
        expect(result.length).toBeGreaterThan(0);
        // Should not return "Unknown" for valid hex colors
        expect(result).not.toBe("Unknown");
      }
    });
  });
});
