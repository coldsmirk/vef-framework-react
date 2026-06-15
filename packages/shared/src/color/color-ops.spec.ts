import { describe, expect, it } from "vitest";

import {
  convertHslToHex,
  convertTransparentToOpaque,
  getColorDifference,
  isValidColor,
  isWhiteColor,
  mixColor,
  setColorAlpha,
  toHexColor,
  toHslColor,
  toHsvColor,
  toRgbColor
} from "..";

describe("color/color-ops", () => {
  describe("isValidColor", () => {
    it("validates correct colors", () => {
      expect(isValidColor("#000000")).toBe(true);
      expect(isValidColor("#ffffff")).toBe(true);
      expect(isValidColor("#ff0000")).toBe(true);
      expect(isValidColor("#000")).toBe(true);
      expect(isValidColor("#fff")).toBe(true);
      expect(isValidColor("rgb(0, 0, 0)")).toBe(true);
      expect(isValidColor("rgba(255, 0, 0, 0.5)")).toBe(true);
      expect(isValidColor("hsl(0, 0%, 0%)")).toBe(true);
      expect(isValidColor("hsla(180, 50%, 50%, 0.8)")).toBe(true);
      expect(isValidColor("red")).toBe(true);
      expect(isValidColor("transparent")).toBe(true);
    });

    it("rejects clearly invalid colors", () => {
      expect(isValidColor("#gggggg")).toBe(false);
      expect(isValidColor("invalid-color")).toBe(false);
      expect(isValidColor("")).toBe(false);
      expect(isValidColor("#")).toBe(false);
    });
  });

  describe("toHexColor", () => {
    it("converts colors to hex format", () => {
      expect(toHexColor("rgb(255, 0, 0)")).toBe("#ff0000");
      expect(toHexColor("rgb(0, 255, 0)")).toBe("#00ff00");
      expect(toHexColor("rgb(0, 0, 255)")).toBe("#0000ff");
      expect(toHexColor("hsl(0, 100%, 50%)")).toBe("#ff0000");
      expect(toHexColor("hsl(120, 100%, 50%)")).toBe("#00ff00");
      expect(toHexColor("red")).toBe("#ff0000");
      expect(toHexColor("white")).toBe("#ffffff");
      expect(toHexColor("black")).toBe("#000000");
    });

    it("normalizes hex colors", () => {
      expect(toHexColor("#FF0000")).toBe("#ff0000");
      expect(toHexColor("#f00")).toBe("#ff0000");
    });
  });

  describe("toRgbColor", () => {
    it("converts colors to RGB format", () => {
      expect(toRgbColor("#ff0000")).toEqual({
        r: 255,
        g: 0,
        b: 0,
        a: 1
      });
      expect(toRgbColor("hsl(0, 100%, 50%)")).toEqual({
        r: 255,
        g: 0,
        b: 0,
        a: 1
      });
      expect(toRgbColor("red")).toEqual({
        r: 255,
        g: 0,
        b: 0,
        a: 1
      });
    });

    it("preserves alpha values", () => {
      expect(toRgbColor("rgba(255, 0, 0, 0.5)")).toEqual({
        r: 255,
        g: 0,
        b: 0,
        a: 0.5
      });
    });
  });

  describe("toHslColor", () => {
    it("converts colors to HSL format", () => {
      expect(toHslColor("#ff0000")).toEqual({
        h: 0,
        s: 100,
        l: 50,
        a: 1
      });
      expect(toHslColor("#00ff00")).toEqual({
        h: 120,
        s: 100,
        l: 50,
        a: 1
      });
      expect(toHslColor("#0000ff")).toEqual({
        h: 240,
        s: 100,
        l: 50,
        a: 1
      });
    });

    it("handles gray colors", () => {
      const gray = toHslColor("#808080");
      expect(gray.s).toBe(0);
      expect(gray.l).toBeCloseTo(50, 1);
    });
  });

  describe("toHsvColor", () => {
    it("converts colors to HSV format", () => {
      expect(toHsvColor("#ff0000")).toEqual({
        h: 0,
        s: 100,
        v: 100,
        a: 1
      });
      expect(toHsvColor("#ffffff")).toEqual({
        h: 0,
        s: 0,
        v: 100,
        a: 1
      });
      expect(toHsvColor("#000000")).toEqual({
        h: 0,
        s: 0,
        v: 0,
        a: 1
      });
    });
  });

  describe("getColorDifference", () => {
    it("returns 0 for identical colors", () => {
      expect(getColorDifference("#ff0000", "#ff0000")).toBe(0);
      expect(getColorDifference("red", "#ff0000")).toBe(0);
    });

    it("returns positive values for different colors", () => {
      expect(getColorDifference("#ff0000", "#00ff00")).toBeGreaterThan(0);
      expect(getColorDifference("#000000", "#ffffff")).toBeGreaterThan(0);
    });

    it("is symmetric", () => {
      const diff1 = getColorDifference("#ff0000", "#00ff00");
      const diff2 = getColorDifference("#00ff00", "#ff0000");
      expect(diff1).toBe(diff2);
    });
  });

  describe("convertHslToHex", () => {
    it("converts HSL objects to hex", () => {
      expect(convertHslToHex({
        h: 0,
        s: 100,
        l: 50
      })).toBe("#ff0000");
      expect(convertHslToHex({
        h: 120,
        s: 100,
        l: 50
      })).toBe("#00ff00");
      expect(convertHslToHex({
        h: 0,
        s: 0,
        l: 100
      })).toBe("#ffffff");
    });
  });

  describe("setColorAlpha", () => {
    it("sets alpha values", () => {
      expect(setColorAlpha("#ff0000", 0.5)).toBe("#ff000080");
      expect(setColorAlpha("#0000ff", 1)).toBe("#0000ff");
      expect(setColorAlpha("#ffffff", 0)).toBe("#ffffff00");
    });

    it("works with different color formats", () => {
      expect(setColorAlpha("red", 0.5)).toBe("#ff000080");
      expect(setColorAlpha("rgb(0, 255, 0)", 0.8)).toBe("#00ff00cc");
    });
  });

  describe("mixColor", () => {
    it("mixes colors at edge ratios", () => {
      expect(mixColor("#ff0000", "#0000ff", 0)).toBe("#ff0000");
      expect(mixColor("#ff0000", "#0000ff", 1)).toBe("#0000ff");
    });

    it("produces valid hex colors", () => {
      const mixed = mixColor("#ff0000", "#0000ff", 0.5);
      expect(mixed).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("works with different formats", () => {
      const result1 = mixColor("red", "blue", 0.5);
      const result2 = mixColor("#ff0000", "#0000ff", 0.5);
      expect(result1).toMatch(/^#[0-9a-f]{6}$/);
      expect(result2).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  describe("convertTransparentToOpaque", () => {
    it("converts transparent colors", () => {
      const result = convertTransparentToOpaque("#ff0000", 0.5);
      expect(result).toBe("#ff8080");
    });

    it("works with custom backgrounds", () => {
      const result = convertTransparentToOpaque("#ff0000", 0.5, "#000000");
      expect(result).toBe("#800000");
    });

    it("handles full opacity and transparency", () => {
      expect(convertTransparentToOpaque("#ff0000", 1)).toBe("#ff0000");
      expect(convertTransparentToOpaque("#ff0000", 0)).toBe("#ffffff");
    });

    it("works with different color formats", () => {
      const result1 = convertTransparentToOpaque("red", 0.5);
      const result2 = convertTransparentToOpaque("rgb(255, 0, 0)", 0.5);
      expect(result1).toBe(result2);
    });
  });

  describe("isWhiteColor", () => {
    it("identifies white colors", () => {
      expect(isWhiteColor("#ffffff")).toBe(true);
      expect(isWhiteColor("#FFFFFF")).toBe(true);
      expect(isWhiteColor("white")).toBe(true);
      expect(isWhiteColor("rgb(255, 255, 255)")).toBe(true);
      expect(isWhiteColor("hsl(0, 0%, 100%)")).toBe(true);
      expect(isWhiteColor("#fff")).toBe(true);
    });

    it("rejects non-white colors", () => {
      expect(isWhiteColor("#000000")).toBe(false);
      expect(isWhiteColor("#fefefe")).toBe(false);
      expect(isWhiteColor("black")).toBe(false);
      expect(isWhiteColor("red")).toBe(false);
      expect(isWhiteColor("rgb(254, 255, 255)")).toBe(false);
    });

    it("handles alpha values", () => {
      expect(isWhiteColor("rgba(255, 255, 255, 0.5)")).toBe(false);
      expect(isWhiteColor("rgba(255, 255, 255, 0)")).toBe(false);
    });
  });

  describe("edge cases and error handling", () => {
    it("handles invalid inputs gracefully", () => {
      expect(() => toHexColor("invalid")).not.toThrow();
      expect(() => toRgbColor("invalid")).not.toThrow();
      expect(() => toHslColor("invalid")).not.toThrow();
    });

    it("maintains consistency across conversions", () => {
      const originalColor = "#ff6600";
      const rgb = toRgbColor(originalColor);
      const hsl = toHslColor(originalColor);
      const hsv = toHsvColor(originalColor);

      expect(toHexColor(rgb)).toBe(originalColor);
      expect(toHexColor(hsl)).toBe(originalColor);
      expect(toHexColor(hsv)).toBe(originalColor);
    });
  });

  describe("performance", () => {
    it("performs operations efficiently", () => {
      const startTime = Date.now();

      for (let i = 0; i < 500; i++) {
        const color = `hsl(${i % 360}, 50%, 50%)`;
        toHexColor(color);
        toRgbColor(color);
        isValidColor(color);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    });
  });
});
