import { describe, expect, it } from "vitest";

import { getOperatorsForField, isOperatorValidForField } from "./condition-operators";

describe("condition-operators", () => {
  it("returns scalar equality and membership operators for a single-value select", () => {
    expect(getOperatorsForField({ kind: "select" })).toEqual([
      "eq",
      "ne",
      "in",
      "not_in",
      "is_empty",
      "is_not_empty"
    ]);
  });

  it("returns element-membership and emptiness operators for a multi-value select", () => {
    expect(getOperatorsForField({ kind: "select", isMultiple: true })).toEqual([
      "contains",
      "not_contains",
      "is_empty",
      "is_not_empty"
    ]);
  });

  it("rejects eq and in on a multi-value select", () => {
    const field = { kind: "select" as const, isMultiple: true };

    expect(isOperatorValidForField(field, "eq")).toBe(false);
    expect(isOperatorValidForField(field, "ne")).toBe(false);
    expect(isOperatorValidForField(field, "in")).toBe(false);
    expect(isOperatorValidForField(field, "not_in")).toBe(false);
    expect(isOperatorValidForField(field, "contains")).toBe(true);
    expect(isOperatorValidForField(field, "not_contains")).toBe(true);
    expect(isOperatorValidForField(field, "is_empty")).toBe(true);
    expect(isOperatorValidForField(field, "is_not_empty")).toBe(true);
  });

  it("rejects contains on a single-value select", () => {
    const field = { kind: "select" as const };

    expect(isOperatorValidForField(field, "contains")).toBe(false);
    expect(isOperatorValidForField(field, "eq")).toBe(true);
    expect(isOperatorValidForField(field, "in")).toBe(true);
  });

  it("returns emptiness operators only for upload fields", () => {
    expect(getOperatorsForField({ kind: "upload" })).toEqual(["is_empty", "is_not_empty"]);
  });

  it("returns no scalar operators for table fields", () => {
    expect(getOperatorsForField({ kind: "table" })).toEqual([]);
  });
});
