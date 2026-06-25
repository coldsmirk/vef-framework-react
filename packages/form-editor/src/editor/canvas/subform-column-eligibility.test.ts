import type { Block } from "../../types";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { isColumnEligibleDefinition, isColumnEligibleNode, isTableColumnField } from "./subform-column-eligibility";

const keyedLeaf: Block = {
  id: "F1",
  type: "textfield",
  key: "name",
  label: "姓名"
};
const unkeyedLeaf: Block = {
  id: "F2",
  type: "textfield",
  key: "",
  label: "缺 key"
};
const container: Block = {
  id: "S1",
  type: "section",
  variant: "card",
  children: []
};

describe("isTableColumnField", () => {
  it("accepts a keyed leaf field", () => {
    expect(isTableColumnField(keyedLeaf)).toBe(true);
  });

  it("rejects a leaf field with an empty key", () => {
    expect(isTableColumnField(unkeyedLeaf)).toBe(false);
  });

  it("rejects a container", () => {
    expect(isTableColumnField(container)).toBe(false);
  });
});

describe("isColumnEligibleNode", () => {
  it("accepts a keyed leaf field", () => {
    expect(isColumnEligibleNode(keyedLeaf)).toBe(true);
  });

  it("rejects a missing node", () => {
    const missing: Block | undefined = undefined;

    expect(isColumnEligibleNode(missing)).toBe(false);
  });

  it("rejects a container", () => {
    expect(isColumnEligibleNode(container)).toBe(false);
  });
});

describe("isColumnEligibleDefinition", () => {
  const registry = createDefaultRegistry();

  it("accepts a keyed leaf field type", () => {
    expect(isColumnEligibleDefinition(registry.get("textfield"))).toBe(true);
  });

  it("rejects a non-keyed leaf type", () => {
    expect(isColumnEligibleDefinition(registry.get("button"))).toBe(false);
  });

  it("rejects a container type", () => {
    expect(isColumnEligibleDefinition(registry.get("subform"))).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(isColumnEligibleDefinition(registry.get("nope"))).toBe(false);
  });
});
