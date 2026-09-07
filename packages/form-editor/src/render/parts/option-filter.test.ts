import { filterOptionByLabel } from "./option-filter";

describe("filterOptionByLabel", () => {
  it("matches an option whose label contains the query", () => {
    expect(filterOptionByLabel("北", { label: "北京", value: "bj" })).toBe(true);
  });

  it("rejects an option whose label does not contain the query", () => {
    expect(filterOptionByLabel("北", { label: "上海", value: "sh" })).toBe(false);
  });

  it("never matches the stored value", () => {
    // "bj" is the storage code behind 北京 and never reaches the screen, so
    // typing it must not surface the option.
    expect(filterOptionByLabel("bj", { label: "北京", value: "bj" })).toBe(false);
  });

  it("ignores the case of the query and of the label", () => {
    expect(filterOptionByLabel("beijing", { label: "BeiJing", value: "bj" })).toBe(true);
    expect(filterOptionByLabel("BEIJING", { label: "beijing", value: "bj" })).toBe(true);
  });

  it("ignores whitespace around the query", () => {
    expect(filterOptionByLabel("  北京  ", { label: "北京", value: "bj" })).toBe(true);
  });

  it("keeps every option while the query is blank", () => {
    expect(filterOptionByLabel(" ", { label: "上海", value: "sh" })).toBe(true);
  });
});
