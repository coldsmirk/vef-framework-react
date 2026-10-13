import { normalizeOptionMapping } from "./option-mapping";

describe("normalizeOptionMapping", () => {
  it("drops blank keys", () => {
    expect(normalizeOptionMapping({
      labelKey: "",
      valueKey: "id",
      disabledKey: " ".repeat(3)
    })).toEqual({ valueKey: "id" });
  });

  it("trims the keys it keeps", () => {
    expect(normalizeOptionMapping({ labelKey: " name " })).toEqual({ labelKey: "name" });
  });

  it("returns undefined when every key is blank", () => {
    expect(normalizeOptionMapping({ labelKey: "", valueKey: "" })).toBeUndefined();
  });

  it("returns undefined for no mapping", () => {
    expect(normalizeOptionMapping(undefined)).toBeUndefined();
  });
});
