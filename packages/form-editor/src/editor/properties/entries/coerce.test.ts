import { coerceToString } from "./coerce";

describe("coerceToString", () => {
  it("passes strings through untouched", () => {
    expect(coerceToString("hello")).toBe("hello");
    expect(coerceToString("")).toBe("");
  });

  it("renders nullish as an empty string", () => {
    // An absent property — how the entries actually produce undefined.
    const field: { placeholder?: string } = {};

    expect(coerceToString(null)).toBe("");
    expect(coerceToString(field.placeholder)).toBe("");
  });

  it("stringifies non-string primitives", () => {
    expect(coerceToString(42)).toBe("42");
    expect(coerceToString(0)).toBe("0");
    expect(coerceToString(false)).toBe("false");
  });
});
