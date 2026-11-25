import { normalizeOptionMapping } from "./option-mapping";

describe("normalizeOptionMapping", () => {
  it("drops blank keys", () => {
    expect(normalizeOptionMapping({
      labelKey: "",
      valueKey: "id",
      disabledKey: " ".repeat(3)
    })).toEqual({ valueKey: "id" });
  });

  it("trims the keys it keeps, including tree hierarchy keys", () => {
    expect(normalizeOptionMapping({
      labelKey: " name ",
      childrenKey: " sub ",
      parentKey: " parentId ",
      descriptionKey: " remark ",
      disabledKey: " frozen "
    })).toEqual({
      labelKey: "name",
      childrenKey: "sub",
      parentKey: "parentId",
      descriptionKey: "remark",
      disabledKey: "frozen"
    });
  });

  it("drops blank hierarchy keys", () => {
    expect(normalizeOptionMapping({
      childrenKey: "  ",
      parentKey: "parentId"
    })).toEqual({ parentKey: "parentId" });
  });

  it("returns undefined when every key is blank", () => {
    expect(normalizeOptionMapping({ labelKey: "", valueKey: "" })).toBeUndefined();
  });

  it("returns undefined for no mapping", () => {
    expect(normalizeOptionMapping(undefined)).toBeUndefined();
  });
});
