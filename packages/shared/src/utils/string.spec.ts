import { describe, expect, it } from "vitest";

import { constantCase, stringify } from "./string";

function namedFn(): number {
  return 1;
}

describe("shared/utils/string/constantCase", () => {
  it("converts camelCase to CONSTANT_CASE", () => {
    expect(constantCase("camelCase")).toBe("CAMEL_CASE");
  });

  it("converts kebab-case to CONSTANT_CASE", () => {
    expect(constantCase("kebab-case")).toBe("KEBAB_CASE");
  });

  it("converts PascalCase to CONSTANT_CASE", () => {
    expect(constantCase("PascalCase")).toBe("PASCAL_CASE");
  });

  it("returns an empty string for an empty input", () => {
    expect(constantCase("")).toBe("");
  });
});

describe("shared/utils/string/stringify", () => {
  describe("nullish handling", () => {
    it("returns an empty string for null", () => {
      expect(stringify(null)).toBe("");
    });

    it("returns an empty string for undefined", () => {
      // eslint-disable-next-line unicorn/no-useless-undefined
      expect(stringify(undefined)).toBe("");
    });
  });

  describe("primitives", () => {
    it("returns the input string unchanged", () => {
      expect(stringify("hello")).toBe("hello");
    });

    it("stringifies numbers", () => {
      expect(stringify(42)).toBe("42");
    });

    it("stringifies booleans", () => {
      expect(stringify(true)).toBe("true");
      expect(stringify(false)).toBe("false");
    });

    it("stringifies bigints", () => {
      expect(stringify(123n)).toBe("123");
    });

    it("stringifies symbols using their toString form", () => {
      expect(stringify(Symbol("token"))).toBe("Symbol(token)");
    });
  });

  describe("complex values", () => {
    it("returns the source string for functions", () => {
      expect(stringify(namedFn)).toContain("namedFn");
    });

    it("JSON-stringifies plain objects", () => {
      expect(stringify({ a: 1, b: "two" })).toBe(JSON.stringify({ a: 1, b: "two" }));
    });

    it("JSON-stringifies arrays", () => {
      expect(stringify([1, 2, 3])).toBe("[1,2,3]");
    });

    it("falls back to String() when JSON.stringify throws (circular reference)", () => {
      const circular: { self?: unknown } = {};
      circular.self = circular;

      const result = stringify(circular);

      expect(result).toBe(String(circular));
    });
  });
});
