import type { CodeMapEntry } from "../../types";

import { describe, expect, it } from "vitest";

import { codeMapFormToParams, formatCodeValue, parseCodeValue, validateCodeMapEntries } from "./model";

describe("parseCodeValue", () => {
  it("parses typed literals and keeps plain text", () => {
    expect(parseCodeValue("1"), "a bare integer should become a number").toBe(1);
    expect(parseCodeValue("-2.5"), "a bare decimal should become a number").toBe(-2.5);
    expect(parseCodeValue("true"), "true should become a boolean").toBe(true);
    expect(parseCodeValue("false"), "false should become a boolean").toBe(false);
    expect(parseCodeValue("M"), "plain text should stay a string").toBe("M");
    expect(parseCodeValue(" M "), "surrounding whitespace should be trimmed").toBe("M");
  });

  it("unwraps quoted literals into strings", () => {
    expect(parseCodeValue("\"1\""), "a quoted number should stay a string").toBe("1");
    expect(parseCodeValue("\"true\""), "a quoted boolean word should stay a string").toBe("true");
    expect(parseCodeValue("\"broken"), "an unterminated quote should stay raw text").toBe("\"broken");
  });
});

describe("formatCodeValue", () => {
  it("round-trips every parseable form", () => {
    for (const text of ["1", "-2.5", "true", "false", "M", "\"1\"", "\"true\""]) {
      expect(formatCodeValue(parseCodeValue(text)), `"${text}" should survive the round trip`).toBe(text);
    }
  });

  it("renders absent values as empty text", () => {
    expect(formatCodeValue(undefined), "undefined should render empty").toBe("");
    expect(formatCodeValue(null), "null should render empty").toBe("");
  });
});

describe("validateCodeMapEntries", () => {
  const valid: CodeMapEntry[] = [
    {
      canonical: "1",
      external: "M",
      externalAliases: ["Male", "m"]
    },
    { canonical: "2", external: "F" },
    {
      canonical: "0",
      external: "U",
      canonicalAliases: ["9"]
    }
  ];

  it("accepts a collision-free map", () => {
    expect(validateCodeMapEntries(valid), "the valid entries should raise no issues").toEqual([]);
    expect(validateCodeMapEntries([]), "an empty map is valid").toEqual([]);
  });

  it("rejects duplicates per side across primaries and aliases", () => {
    const duplicatePrimary = [...valid, { canonical: "1", external: "X" }];
    expect(validateCodeMapEntries(duplicatePrimary), "a duplicate canonical primary should be reported").toHaveLength(1);

    const aliasCollision = [
      ...valid,
      {
        canonical: "3",
        external: "X",
        externalAliases: ["Male"]
      }
    ];
    expect(validateCodeMapEntries(aliasCollision), "an alias colliding with another entry should be reported").toHaveLength(1);

    const crossType = [...valid, { canonical: 1, external: "X" }];
    expect(validateCodeMapEntries(crossType), "1 and \"1\" should collide by normalized form").toHaveLength(1);
  });

  it("allows the same value on opposite sides", () => {
    const mirrored: CodeMapEntry[] = [{ canonical: "1", external: "1" }];
    expect(validateCodeMapEntries(mirrored), "sides are independent key spaces").toEqual([]);
  });

  it("rejects empty values", () => {
    expect(validateCodeMapEntries([{ canonical: "", external: "M" }]), "an empty primary should be reported").toHaveLength(1);
  });
});

describe("codeMapFormToParams", () => {
  const base = {
    systemId: "sys-1",
    codeSet: "gender",
    name: "性别",
    entries: [],
    fallbackCanonical: "0",
    fallbackExternal: "1",
    isEnabled: true
  };

  it("submits typed fallback values only under the fallback policy", () => {
    const params = codeMapFormToParams({ ...base, onUnmapped: "fallback" });
    expect(params.fallbackCanonical, "the canonical fallback should be parsed").toBe(0);
    expect(params.fallbackExternal, "the external fallback should be parsed").toBe(1);

    const rejected = codeMapFormToParams({ ...base, onUnmapped: "reject" });
    expect(rejected.fallbackCanonical, "reject must not submit a canonical fallback").toBeUndefined();
    expect(rejected.fallbackExternal, "reject must not submit an external fallback").toBeUndefined();
  });
});
