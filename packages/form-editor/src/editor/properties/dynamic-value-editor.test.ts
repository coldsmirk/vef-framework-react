import { describe, expect, it } from "vitest";

import { setDynamicValueMode } from "./dynamic-value-editor";

describe("setDynamicValueMode", () => {
  it("保持模式不变时原样返回，避免来回切换丢掉已填内容", () => {
    const literal = { kind: "literal", value: "x" } as const;

    expect(setDynamicValueMode(literal, "literal")).toBe(literal);
  });

  it("双向切换模式时重置载荷", () => {
    const literal = { kind: "literal", value: "x" } as const;

    const expression = setDynamicValueMode(literal, "expression");
    expect(expression).toEqual({ kind: "expression", source: "" });

    expect(setDynamicValueMode(expression, "literal")).toEqual({ kind: "literal", value: "" });
  });
});
