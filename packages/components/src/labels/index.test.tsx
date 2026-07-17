import { formatLabelFilters, isValidLabel, parseLabelFilters } from "./index";

describe("isValidLabel", () => {
  it("accepts a typical key-value pair", () => {
    expect(isValidLabel("app", "crm")).toBe(true);
  });

  it("accepts a single-character key", () => {
    expect(isValidLabel("a", "x")).toBe(true);
  });

  it("accepts mixed separators inside the key", () => {
    expect(isValidLabel("env-2_stage", "x")).toBe(true);
  });

  it("accepts an empty value as a presence flag", () => {
    expect(isValidLabel("mobile", "")).toBe(true);
  });

  it("accepts boundary lengths", () => {
    expect(isValidLabel("k".repeat(63), "v".repeat(256))).toBe(true);
  });

  it("counts value length in characters, not bytes", () => {
    expect(isValidLabel("app", "值".repeat(256))).toBe(true);
  });

  describe("when the key would escape the backend filter", () => {
    it("rejects a dotted key", () => {
      expect(isValidLabel("app.id", "x")).toBe(false);
    });

    it("rejects a leading dash", () => {
      expect(isValidLabel("-app", "x")).toBe(false);
    });

    it("rejects a trailing dash", () => {
      expect(isValidLabel("app-", "x")).toBe(false);
    });

    it("rejects whitespace", () => {
      expect(isValidLabel("app id", "x")).toBe(false);
    });

    it("rejects an empty key", () => {
      expect(isValidLabel("", "x")).toBe(false);
    });

    it("rejects an over-long key", () => {
      expect(isValidLabel("k".repeat(64), "x")).toBe(false);
    });
  });

  it("rejects an over-long value", () => {
    expect(isValidLabel("app", "v".repeat(257))).toBe(false);
  });
});

describe("parseLabelFilters", () => {
  it("splits entries on the first equals sign", () => {
    expect(parseLabelFilters(["app=crm", "region=cn=east"])).toEqual({ app: "crm", region: "cn=east" });
  });

  it("treats a bare key as an empty-value presence match", () => {
    expect(parseLabelFilters(["mobile"])).toEqual({ mobile: "" });
  });

  it("trims whitespace around keys and values", () => {
    expect(parseLabelFilters([" app = crm "])).toEqual({ app: "crm" });
  });

  it("drops entries without a key", () => {
    expect(parseLabelFilters(["=crm"])).toBeUndefined();
  });

  it("returns undefined for an empty entry list", () => {
    expect(parseLabelFilters([])).toBeUndefined();
  });
});

describe("formatLabelFilters", () => {
  it("serializes pairs back to key=value entries", () => {
    expect(formatLabelFilters({ app: "crm" })).toEqual(["app=crm"]);
  });

  it("serializes an empty value as the bare key", () => {
    expect(formatLabelFilters({ mobile: "" })).toEqual(["mobile"]);
  });

  it("returns an empty list for an absent map", () => {
    expect(formatLabelFilters(undefined)).toEqual([]);
  });

  it("round-trips through parseLabelFilters", () => {
    const labels = { app: "crm", mobile: "" };

    expect(parseLabelFilters(formatLabelFilters(labels))).toEqual(labels);
  });
});
