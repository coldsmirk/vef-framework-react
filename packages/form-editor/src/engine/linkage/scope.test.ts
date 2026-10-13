import {
  leafSourceFormKey,
  parseLeafSource,
  resolveLeafSourceValue,
  withContextValues,
  withLeafSourceFormKey
} from "./scope";

describe("parseLeafSource", () => {
  it("reads a plain key as a form value", () => {
    expect(parseLeafSource("amount")).toEqual({
      kind: "form",
      key: "amount",
      path: []
    });
  });

  it("reads the $form spelling as the same form value", () => {
    expect(parseLeafSource("$form.amount")).toEqual({
      kind: "form",
      key: "amount",
      path: []
    });
  });

  it("keeps the path below a $form key", () => {
    expect(parseLeafSource("$form.address.city")).toEqual({
      kind: "form",
      key: "address",
      path: ["city"]
    });
  });

  it("reads an applicant path as context", () => {
    expect(parseLeafSource("$applicant.departmentId")).toEqual({
      kind: "context",
      root: "$applicant",
      path: ["departmentId"]
    });
  });

  it("reads a globals path as context", () => {
    expect(parseLeafSource("$globals.staffTitle")).toEqual({
      kind: "context",
      root: "$globals",
      path: ["staffTitle"]
    });
  });

  it("rejects a root no scope slot answers to", () => {
    expect(parseLeafSource("$applcant.departmentId")).toEqual({ kind: "unknown" });
  });

  it("rejects a bare $form without a key", () => {
    expect(parseLeafSource("$form")).toEqual({ kind: "unknown" });
  });
});

describe("leafSourceFormKey", () => {
  it("returns the key of a plain source", () => {
    expect(leafSourceFormKey("amount")).toBe("amount");
  });

  it("returns the key of a $form source", () => {
    expect(leafSourceFormKey("$form.amount.value")).toBe("amount");
  });

  it("returns undefined for a context source", () => {
    expect(leafSourceFormKey("$applicant.id")).toBeUndefined();
  });
});

describe("withLeafSourceFormKey", () => {
  it("replaces a plain key", () => {
    expect(withLeafSourceFormKey("amount", "total")).toBe("total");
  });

  it("keeps the $form spelling and the trailing path", () => {
    expect(withLeafSourceFormKey("$form.address.city", "location")).toBe("$form.location.city");
  });

  it("leaves a context source untouched", () => {
    expect(withLeafSourceFormKey("$applicant.id", "total")).toBe("$applicant.id");
  });
});

describe("resolveLeafSourceValue", () => {
  describe("when the source is a form value", () => {
    it("reads a plain key", () => {
      expect(resolveLeafSourceValue("amount", { amount: 3 }, undefined)).toBe(3);
    });

    it("reads a nested $form path", () => {
      expect(resolveLeafSourceValue("$form.address.city", { address: { city: "Hangzhou" } }, undefined)).toBe("Hangzhou");
    });

    it("never reads a prototype member as a value", () => {
      expect(resolveLeafSourceValue("constructor", {}, undefined)).toBeUndefined();
    });
  });

  describe("when the source is a context path", () => {
    it("reads the applicant slot", () => {
      expect(resolveLeafSourceValue("$applicant.departmentName", {}, { applicant: { departmentName: "财务部" } })).toBe("财务部");
    });

    it("reads the globals slot", () => {
      expect(resolveLeafSourceValue("$globals.staffTitle", {}, { globals: { staffTitle: "主任医师" } })).toBe("主任医师");
    });

    it("never reads a prototype member off a context slot", () => {
      expect(resolveLeafSourceValue("$applicant.constructor", {}, { applicant: {} })).toBeUndefined();
    });

    it("resolves a member of a primitive to undefined", () => {
      expect(resolveLeafSourceValue("$user.profile.city", {}, { user: { profile: "plain" } })).toBeUndefined();
    });

    it("resolves to undefined without a context", () => {
      expect(resolveLeafSourceValue("$applicant.id", {}, undefined)).toBeUndefined();
    });
  });

  it("resolves an unknown root to undefined", () => {
    expect(resolveLeafSourceValue("$unknown.id", { id: 1 }, { user: { id: 1 } })).toBeUndefined();
  });
});

describe("withContextValues", () => {
  it("lays a value into its slot without dropping the slot's other members", () => {
    const context = { applicant: { id: "u-1", name: "张三" } };

    expect(withContextValues(context, new Map([["$applicant.departmentName", "财务部"]]))).toEqual({
      applicant: {
        id: "u-1",
        name: "张三",
        departmentName: "财务部"
      }
    });
  });

  it("creates the slot and the intermediate objects a path needs", () => {
    expect(withContextValues(undefined, new Map([["$globals.limits.amount", 500]]))).toEqual({
      globals: { limits: { amount: 500 } }
    });
  });

  it("leaves the input context unmodified", () => {
    const context = { applicant: { id: "u-1" } };

    withContextValues(context, new Map([["$applicant.id", "u-2"]]));

    expect(context).toEqual({ applicant: { id: "u-1" } });
  });

  it("returns the input context itself when no path names a context member", () => {
    const context = { applicant: { id: "u-1" } };

    expect(withContextValues(context, new Map<string, unknown>([["amount", 1], ["$applicant", "x"], ["$nope.x", 1]]))).toBe(context);
  });
});
