import { resolveScopeValues } from "./resolve-scope-values";

describe("resolveScopeValues", () => {
  it("returns the whole values object for the root scope", () => {
    const values = { name: "a", age: 1 };

    expect(resolveScopeValues(values, "")).toBe(values);
  });

  it("walks to a subform row record", () => {
    const values = { lines: [{ amount: "10" }, { amount: "20" }] };

    expect(resolveScopeValues(values, "lines[0].")).toEqual({ amount: "10" });
    expect(resolveScopeValues(values, "lines[1].")).toEqual({ amount: "20" });
  });

  it("indexes arrays via numeric tokens", () => {
    const values = { rows: [{ cols: [{ v: "x" }] }] };

    expect(resolveScopeValues(values, "rows[0].cols[0].")).toEqual({ v: "x" });
  });

  it("returns an empty object when the path is missing", () => {
    const values = { lines: [{ amount: "10" }] };

    expect(resolveScopeValues(values, "lines[5].")).toEqual({});
  });

  it("returns an empty object when the path resolves to a non-object", () => {
    const values = { lines: [{ amount: "10" }] };

    expect(resolveScopeValues(values, "lines[0].amount.")).toEqual({});
  });
});
