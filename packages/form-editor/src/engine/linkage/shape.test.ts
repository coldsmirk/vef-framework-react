import type { FieldLinkage, FieldLinkageRule } from "../../types";

import { describe, expect, it } from "vitest";

import { hasConditionTriggeredShow, linkageRules, ruleActions, ruleCondition, ruleTriggerKind } from "./shape";

// Every case here is a document the RENDER path can legally receive:
// FormRenderer never calls validateSchema, so the runtime schema is whatever
// the host parsed out of storage. `as` casts stand in for that untyped input.
describe("linkageRules", () => {
  it("returns the rules of a well-formed block", () => {
    const rules = [
      {
        id: "R1",
        trigger: { kind: "change" },
        actions: []
      }
    ] as unknown as FieldLinkageRule[];

    expect(linkageRules({ rules } as FieldLinkage)).toBe(rules);
  });

  it("returns an empty list for an absent block or absent rules", () => {
    expect(linkageRules(undefined)).toEqual([]);
    expect(linkageRules({} as FieldLinkage)).toEqual([]);
  });

  it("returns an empty list when rules is not an array", () => {
    // The case a bare `?? []` misses: an object is neither null nor undefined,
    // so it reaches `for…of` and throws "is not iterable", white-screening the
    // whole form.
    expect(linkageRules({ rules: {} } as unknown as FieldLinkage)).toEqual([]);
    expect(linkageRules({ rules: "" } as unknown as FieldLinkage)).toEqual([]);
  });
});

describe("ruleTriggerKind", () => {
  it("reads the kind of a well-formed rule", () => {
    expect(ruleTriggerKind({ trigger: { kind: "blur" } } as FieldLinkageRule)).toBe("blur");
  });

  it("returns undefined for a rule with no trigger", () => {
    expect(ruleTriggerKind({ id: "R1", actions: [] } as unknown as FieldLinkageRule)).toBeUndefined();
    expect(ruleTriggerKind({ trigger: null } as unknown as FieldLinkageRule)).toBeUndefined();
    expect(ruleTriggerKind(null as unknown as FieldLinkageRule)).toBeUndefined();
  });
});

describe("ruleActions", () => {
  it("reads the actions of a well-formed rule", () => {
    const actions = [{ type: "show" }] as unknown as FieldLinkageRule["actions"];

    expect(ruleActions({ actions } as FieldLinkageRule)).toBe(actions);
  });

  it("returns an empty list when actions is missing or not an array", () => {
    expect(ruleActions({ trigger: { kind: "change" } } as FieldLinkageRule)).toEqual([]);
    expect(ruleActions({ actions: {} } as unknown as FieldLinkageRule)).toEqual([]);
  });
});

describe("ruleCondition", () => {
  const condition = {
    kind: "leaf",
    sourceKey: "a",
    operator: "notEmpty"
  };

  it("reads the condition of a condition-triggered rule", () => {
    expect(ruleCondition({ trigger: { kind: "condition", condition } } as unknown as FieldLinkageRule)).toBe(condition);
  });

  it("returns undefined for any other trigger kind", () => {
    expect(ruleCondition({ trigger: { kind: "change" } } as FieldLinkageRule)).toBeUndefined();
  });

  it("returns undefined for a malformed rule", () => {
    expect(ruleCondition({} as FieldLinkageRule)).toBeUndefined();
  });
});

describe("hasConditionTriggeredShow", () => {
  const show = { type: "show" };

  it("accepts a condition-triggered show", () => {
    const rules = [{ trigger: { kind: "condition", condition: {} }, actions: [show] }];

    expect(hasConditionTriggeredShow(rules)).toBe(true);
  });

  it("rejects a show on an edge trigger", () => {
    // `state_action_on_edge_trigger` rejects this rule separately, so it never
    // reaches the state lane and can never lift a default-hidden block. Both
    // the validator warning and the delete-impact preview depend on that.
    const rules = [{ trigger: { kind: "change" }, actions: [show] }];

    expect(hasConditionTriggeredShow(rules)).toBe(false);
  });

  it("rejects a condition-triggered rule with no show", () => {
    const rules = [{ trigger: { kind: "condition", condition: {} }, actions: [{ type: "hide" }] }];

    expect(hasConditionTriggeredShow(rules)).toBe(false);
  });

  it("rejects malformed input rather than throwing", () => {
    expect(hasConditionTriggeredShow(undefined)).toBe(false);
    expect(hasConditionTriggeredShow({})).toBe(false);
    expect(hasConditionTriggeredShow([null, { trigger: {} }])).toBe(false);
  });
});
