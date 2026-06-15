import type { PresentationLayer, SubformNode, TextfieldField } from "../types";

import {
  collectScopeKeys,
  generateUniqueKey,
  isKeyedField,
  isKeyedNode,
  isValidatableField,
  nextUniqueKey,
  sanitizeKey
} from "./keys";

function tf(id: string, key: string): TextfieldField {
  return {
    id,
    type: "textfield",
    key
  };
}

function schemaWith(...rootKeys: string[]): PresentationLayer {
  return {
    children: rootKeys.map((key, index) => tf(`Field_${index}`, key))
  };
}

describe("keys", () => {
  describe("nextUniqueKey", () => {
    it("returns the base key when unused", () => {
      const used = new Set<string>();

      expect(nextUniqueKey(used, "amount")).toBe("amount");
    });

    it("suffixes with the first free index on collision", () => {
      const used = new Set(["amount", "amount_2"]);

      expect(nextUniqueKey(used, "amount")).toBe("amount_3");
    });

    it("records each allocation so repeated calls stay unique", () => {
      const used = new Set<string>();

      expect(nextUniqueKey(used, "amount")).toBe("amount");
      expect(nextUniqueKey(used, "amount")).toBe("amount_2");
    });
  });

  describe("generateUniqueKey", () => {
    it("suffixes a key already used at the root scope", () => {
      const schema = schemaWith("textfield");

      expect(generateUniqueKey(schema, "textfield")).toBe("textfield_2");
    });

    it("allows a subform scope to reuse a root key", () => {
      const subform: SubformNode = {
        id: "Sub_1",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: []
      };
      const schema: PresentationLayer = {
        children: [tf("Field_0", "amount"), subform]
      };

      // The same base is free inside the (empty) subform scope even though it
      // is taken at the root.
      expect(generateUniqueKey(schema, "amount", ["lines"])).toBe("amount");
      expect(generateUniqueKey(schema, "amount", [])).toBe("amount_2");
    });
  });

  describe("collectScopeKeys", () => {
    it("collects only the keys at the requested scope", () => {
      const subform: SubformNode = {
        id: "Sub_1",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("Field_t", "amount")]
      };
      const schema: PresentationLayer = {
        children: [tf("Field_0", "name"), subform]
      };

      expect(collectScopeKeys(schema, [])).toEqual(new Set(["name", "lines"]));
      expect(collectScopeKeys(schema, ["lines"])).toEqual(new Set(["amount"]));
    });
  });

  describe("isKeyedNode", () => {
    it("is true for a keyed leaf field", () => {
      expect(isKeyedNode(tf("Field_1", "name"))).toBe(true);
    });

    it("is false for a non-keyed button field", () => {
      expect(isKeyedNode({ id: "Field_b", type: "button" })).toBe(false);
    });

    it("is false for an empty-string key (matches validateSchema's length > 0)", () => {
      expect(isKeyedNode(tf("Field_1", ""))).toBe(false);
    });
  });

  describe("isKeyedField", () => {
    it("is true for a keyed leaf field", () => {
      expect(isKeyedField(tf("Field_1", "name"))).toBe(true);
    });

    it("is false for an empty-string key", () => {
      expect(isKeyedField(tf("Field_1", ""))).toBe(false);
    });

    it("is false for a non-keyed button field", () => {
      expect(isKeyedField({ id: "Field_b", type: "button" })).toBe(false);
    });
  });

  describe("sanitizeKey", () => {
    it("strips path-reserved characters from a user-typed key", () => {
      expect(sanitizeKey("a.b[0]/c")).toBe("ab0c");
    });

    it("keeps letters, digits, and underscores untouched", () => {
      expect(sanitizeKey("amount_2")).toBe("amount_2");
    });

    it("returns an empty string for an all-invalid input", () => {
      expect(sanitizeKey(".[]/")).toBe("");
    });

    it("produces keys that satisfy the validator's key charset", () => {
      // `validateSchema` enforces `^\w+$` on every registered key; any
      // non-empty sanitized key must pass that grammar.
      expect(/^\w+$/.test(sanitizeKey("a.b/c d-e"))).toBe(true);
    });
  });

  describe("isValidatableField", () => {
    it("narrows a field carrying a validate slot", () => {
      const field: TextfieldField = {
        id: "Field_1",
        type: "textfield",
        key: "name",
        validate: { required: true }
      };

      expect(isValidatableField(field)).toBe(true);
    });

    it("is false for a field type without a validate slot", () => {
      expect(isValidatableField({ id: "Field_b", type: "button" })).toBe(false);
    });

    it("is presence-based: false for a validatable type whose validate slot is absent", () => {
      expect(isValidatableField(tf("Field_1", "name"))).toBe(false);
    });
  });
});
