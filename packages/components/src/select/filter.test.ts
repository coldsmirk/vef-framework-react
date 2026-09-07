import type { SelectOption } from ".";

import { describe, expect, it } from "vitest";

import { filterOptionByLabel } from "./filter";

describe("filterOptionByLabel", () => {
  const beijing: SelectOption = { label: "北京", value: "bj" };

  it("matches the option label", () => {
    expect(filterOptionByLabel("北京", beijing)).toBe(true);
    expect(filterOptionByLabel("上海", beijing)).toBe(false);
  });

  it("never matches the option value", () => {
    // "bj" is 北京's stored code — antd's default filter matches it, which is
    // the behaviour a user typing visible text never sees.
    expect(filterOptionByLabel("bj", beijing)).toBe(false);
  });

  it("matches case-insensitively", () => {
    const option: SelectOption = { label: "Beijing", value: "bj" };

    expect(filterOptionByLabel("beIJing", option)).toBe(true);
    expect(filterOptionByLabel("BEI", option)).toBe(true);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(filterOptionByLabel("  北京 ", beijing)).toBe(true);
  });

  it("keeps every option for a blank query", () => {
    // An all-whitespace query is not a filter — collapsing it to "match
    // nothing" would blank the dropdown the moment the user hits space.
    expect(filterOptionByLabel("", beijing)).toBe(true);
    expect(filterOptionByLabel(" ".repeat(3), beijing)).toBe(true);
  });

  it("rejects an option with no string label", () => {
    expect(filterOptionByLabel("北京", undefined)).toBe(false);
    expect(filterOptionByLabel("北京", { value: "bj" })).toBe(false);
    // A ReactNode label carries no text to compare — antd allows one, and
    // stringifying it would match on React internals rather than on what the
    // user sees.
    expect(filterOptionByLabel("北京", { label: 42, value: "bj" } as SelectOption)).toBe(false);
  });
});
