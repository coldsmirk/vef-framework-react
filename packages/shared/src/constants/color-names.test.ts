import { describe, expect, it } from "vitest";

import { colorEntries, colorNameMap } from "..";

describe("constants/color-names", () => {
  describe("colorNameMap", () => {
    it("is a Map instance", () => {
      expect(colorNameMap).toBeInstanceOf(Map);
    });

    it("has the same size as colorEntries", () => {
      expect(colorNameMap.size).toBe(colorEntries.length);
    });

    it("contains all color entries from colorEntries array", () => {
      for (const [hex, name] of colorEntries) {
        expect(colorNameMap.has(hex)).toBe(true);
        expect(colorNameMap.get(hex)).toBe(name);
      }
    });

    it("maps hex values to correct color names", () => {
      // Test some specific well-known colors
      expect(colorNameMap.get("#000000")).toBe("Black");
      expect(colorNameMap.get("#ffffff")).toBe("White");
      expect(colorNameMap.get("#ff0000")).toBe("Red");
      expect(colorNameMap.get("#00ff00")).toBe("Green");
      expect(colorNameMap.get("#0000ff")).toBe("Blue");
      expect(colorNameMap.get("#ffff00")).toBe("Yellow");
      expect(colorNameMap.get("#ff00ff")).toBe("Magenta Fuchsia");
      expect(colorNameMap.get("#00ffff")).toBe("Cyan Aqua");
    });

    it("returns undefined for unknown hex values", () => {
      expect(colorNameMap.get("#123456" as never)).toBeUndefined();
      expect(colorNameMap.get("#abcdef" as never)).toBeUndefined();
      expect(colorNameMap.get("#999999" as never)).toBeUndefined();
    });

    it("has all hex values in lowercase format", () => {
      for (const hex of colorNameMap.keys()) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(hex).toBe(hex.toLowerCase());
      }
    });

    it("has all color names as non-empty strings", () => {
      for (const name of colorNameMap.values()) {
        expect(typeof name).toBe("string");
        expect(name.length).toBeGreaterThan(0);
        // Some color names may have trailing spaces as they appear in the source data
        expect(name.trim().length).toBeGreaterThan(0);
      }
    });

    it("maintains case sensitivity for color names", () => {
      // Test that color names maintain proper capitalization
      expect(colorNameMap.get("#000080")).toBe("Navy Blue");
      expect(colorNameMap.get("#660099")).toBe("Purple");
      expect(colorNameMap.get("#00ff00")).toBe("Green");
    });

    it("handles edge case colors correctly", () => {
      // Test some edge cases from the color entries
      expect(colorNameMap.get("#fafafa")).toBe("Alabaster");
      expect(colorNameMap.get("#fffefd")).toBe("Romance");

      // This color doesn't exist in entries
      expect(colorNameMap.get("#000001" as never)).toBeUndefined();
    });

    it("has unique hex keys", () => {
      const hexValues = colorNameMap.keys().toArray();
      const uniqueHexValues = new Set(hexValues);
      expect(hexValues).toHaveLength(uniqueHexValues.size);
    });

    it("performs fast lookups", () => {
      const startTime = performance.now();

      // Perform many lookups
      for (let i = 0; i < 1000; i++) {
        colorNameMap.get("#ff0000");
        colorNameMap.get("#00ff00");
        colorNameMap.get("#0000ff");
        colorNameMap.has("#ffffff");
        colorNameMap.has("#000000");
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 10ms for 5000 operations)
      expect(duration).toBeLessThan(10);
    });
  });
});
