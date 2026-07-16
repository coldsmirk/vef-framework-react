import { formatLabelFilters, isValidFlowLabel, parseLabelFilters } from "./index";

describe("isValidFlowLabel", () => {
  it("accepts a typical key-value pair", () => {
    expect(isValidFlowLabel("app", "crm")).toBe(true);
  });

  it("accepts a single-character key", () => {
    expect(isValidFlowLabel("a", "x")).toBe(true);
  });

  it("accepts mixed separators inside the key", () => {
    expect(isValidFlowLabel("env-2_stage", "x")).toBe(true);
  });

  it("accepts an empty value as a presence flag", () => {
    expect(isValidFlowLabel("mobile", "")).toBe(true);
  });

  it("accepts boundary lengths", () => {
    expect(isValidFlowLabel("k".repeat(63), "v".repeat(256))).toBe(true);
  });

  it("counts value length in characters, not bytes", () => {
    expect(isValidFlowLabel("app", "值".repeat(256))).toBe(true);
  });

  describe("when the key would escape the backend filter", () => {
    it("rejects a dotted key", () => {
      expect(isValidFlowLabel("app.id", "x")).toBe(false);
    });

    it("rejects a leading dash", () => {
      expect(isValidFlowLabel("-app", "x")).toBe(false);
    });

    it("rejects a trailing dash", () => {
      expect(isValidFlowLabel("app-", "x")).toBe(false);
    });

    it("rejects whitespace", () => {
      expect(isValidFlowLabel("app id", "x")).toBe(false);
    });

    it("rejects an empty key", () => {
      expect(isValidFlowLabel("", "x")).toBe(false);
    });

    it("rejects an over-long key", () => {
      expect(isValidFlowLabel("k".repeat(64), "x")).toBe(false);
    });
  });

  it("rejects an over-long value", () => {
    expect(isValidFlowLabel("app", "v".repeat(257))).toBe(false);
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
