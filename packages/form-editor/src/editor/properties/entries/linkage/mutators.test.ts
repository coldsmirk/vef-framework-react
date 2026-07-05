import type { FieldLinkage, FieldLinkageRule, LinkageCondition, LinkageConditionGroup } from "../../../../types";

import { describe, expect, it } from "vitest";

import {
  appendChild,
  conditionHasAuthoredContent,
  createActionFor,
  createExpression,
  createFormRule,
  createGroup,
  createLeaf,
  createRule,
  createTrigger,
  normalizeLinkage,
  reconcileRuleTrigger,
  removeAtPath,
  setActionValueMode,
  updateAtPath
} from "./mutators";

function conditionRule(...actions: FieldLinkageRule["actions"]): FieldLinkageRule {
  return {
    id: "R1",
    trigger: {
      kind: "condition",
      condition: {
        kind: "leaf",
        sourceKey: "a",
        operator: "eq",
        value: "x"
      }
    },
    actions
  };
}

describe("createActionFor", () => {
  it("builds a payload-free action from its tag", () => {
    expect(createActionFor("hide")).toEqual({ id: expect.any(String), type: "hide" });
    expect(createActionFor("submit")).toEqual({ id: expect.any(String), type: "submit" });
  });

  it("seeds value-bearing actions with literal defaults", () => {
    expect(createActionFor("assign")).toEqual({
      id: expect.any(String),
      type: "assign",
      value: { kind: "literal", value: "" }
    });
    expect(createActionFor("set_field")).toEqual({
      id: expect.any(String),
      type: "set_field",
      targetKey: "",
      value: { kind: "literal", value: "" }
    });
    expect(createActionFor("set_variable")).toEqual({
      id: expect.any(String),
      type: "set_variable",
      variable: "",
      value: { kind: "literal", value: "" }
    });
    expect(createActionFor("alert")).toEqual({
      id: expect.any(String),
      type: "alert",
      level: "info",
      message: { kind: "literal", value: "" }
    });
    expect(createActionFor("api_call")).toEqual({
      id: expect.any(String),
      type: "api_call",
      request: { resource: "", action: "" }
    });
  });

  it("seeds a refresh_data_source with an empty data source id", () => {
    expect(createActionFor("refresh_data_source")).toEqual({
      id: expect.any(String),
      type: "refresh_data_source",
      dataSourceId: ""
    });
  });

  it("gives each created action a unique id for stable list keys", () => {
    expect(createActionFor("hide").id).not.toBe(createActionFor("hide").id);
  });
});

describe("reconcileRuleTrigger", () => {
  it("keeps state actions when reconciling to a condition trigger in a state-allowing scope", () => {
    const rule = conditionRule({ type: "show" }, { type: "alert", message: { kind: "literal", value: "hi" } });

    const next = reconcileRuleTrigger(rule, {
      kind: "condition",
      condition: {
        kind: "group",
        logic: "all",
        children: []
      }
    }, true);

    expect(next.actions).toEqual(rule.actions);
  });

  it("strips state actions when reconciling to an edge trigger", () => {
    const rule = conditionRule({ type: "show" }, { type: "alert", message: { kind: "literal", value: "hi" } });

    const next = reconcileRuleTrigger(rule, { kind: "change" }, true);

    // The now-illegal `show` is dropped; the effect action survives.
    expect(next.actions).toEqual([{ type: "alert", message: { kind: "literal", value: "hi" } }]);
  });

  it("strips state actions when the scope forbids them, even under a condition trigger", () => {
    const rule = conditionRule({ type: "hide" }, { type: "submit" });

    const next = reconcileRuleTrigger(rule, rule.trigger, false);

    expect(next.actions).toEqual([{ type: "submit" }]);
  });

  it("seeds an alert when stripping empties the action list", () => {
    const rule = conditionRule({ type: "show" });

    const next = reconcileRuleTrigger(rule, { kind: "blur" }, true);

    expect(next.actions).toEqual([
      {
        id: expect.any(String),
        type: "alert",
        level: "info",
        message: { kind: "literal", value: "" }
      }
    ]);
  });

  it("strips retrigger when moving to an edge trigger", () => {
    const rule = conditionRule({
      type: "alert",
      message: { kind: "literal", value: "hi" },
      retrigger: "always"
    });

    const next = reconcileRuleTrigger(rule, { kind: "change" }, true);

    // An edge already pulses per event — a kept retrigger would be dead
    // configuration the validator flags as `retrigger_ignored`.
    expect(next.actions).toEqual([{ type: "alert", message: { kind: "literal", value: "hi" } }]);
    expect(next.actions[0]).not.toHaveProperty("retrigger");
  });

  it("keeps retrigger when the new trigger is still a condition", () => {
    const action = {
      type: "alert",
      message: { kind: "literal", value: "hi" },
      retrigger: "always"
    } as const;
    const rule = conditionRule(action);

    const next = reconcileRuleTrigger(rule, createTrigger("condition", "a"), true);

    expect(next.actions).toEqual([action]);
  });
});

describe("seed factories", () => {
  it("creates a leaf with a stable id and eq defaults", () => {
    expect(createLeaf("amount")).toEqual({
      kind: "leaf",
      id: expect.any(String),
      sourceKey: "amount",
      operator: "eq",
      value: ""
    });
  });

  it("creates an expression with an empty source", () => {
    expect(createExpression()).toEqual({
      kind: "expression",
      id: expect.any(String),
      source: ""
    });
  });

  it("creates a condition trigger seeded with one leaf on the source key", () => {
    expect(createTrigger("condition", "amount")).toEqual({
      kind: "condition",
      condition: {
        kind: "group",
        id: expect.any(String),
        logic: "all",
        children: [
          {
            kind: "leaf",
            id: expect.any(String),
            sourceKey: "amount",
            operator: "eq",
            value: ""
          }
        ]
      }
    });
  });

  it("creates payload-free edge triggers", () => {
    expect(createTrigger("blur")).toEqual({ kind: "blur" });
  });

  it("seeds a condition+show rule when a source key exists", () => {
    const rule = createRule("amount", true);

    expect(rule.trigger.kind).toBe("condition");
    expect(rule.actions).toEqual([{ id: expect.any(String), type: "show" }]);
  });

  it("seeds a change+alert rule for a keyed target without a source", () => {
    const rule = createRule(undefined, true);

    expect(rule.trigger).toEqual({ kind: "change" });
    expect(rule.actions[0]).toMatchObject({ type: "alert" });
  });

  it("seeds a click+alert rule for a non-keyed target without a source", () => {
    expect(createRule(undefined, false).trigger).toEqual({ kind: "click" });
  });

  it("seeds a form rule on afterSubmit when no root source exists", () => {
    const rule = createFormRule();

    expect(rule.trigger).toEqual({ kind: "afterSubmit" });
    expect(rule.actions[0]).toMatchObject({ type: "alert" });
  });
});

describe("normalizeLinkage", () => {
  it("returns undefined when nothing meaningful is left", () => {
    expect(normalizeLinkage({ defaults: { hidden: false, required: false }, rules: [] })).toBeUndefined();
  });

  it("keeps only the true default flags", () => {
    expect(normalizeLinkage({ defaults: { hidden: true, disabled: false } })).toEqual({ defaults: { hidden: true } });
  });

  it("round-trips defaults and rules untouched", () => {
    const linkage: FieldLinkage = {
      defaults: { hidden: true },
      rules: [conditionRule({ type: "show" })]
    };

    expect(normalizeLinkage(linkage)).toEqual(linkage);
  });
});

/**
 * A two-level condition tree: root group G0 holding leaf L0 and nested group
 * G1 (with leaf L1) — the path-mutator fixture.
 */
function tree(): LinkageConditionGroup {
  return {
    kind: "group",
    id: "G0",
    logic: "all",
    children: [
      {
        kind: "leaf",
        id: "L0",
        sourceKey: "a",
        operator: "eq",
        value: "1"
      },
      {
        kind: "group",
        id: "G1",
        logic: "any",
        children: [
          {
            kind: "leaf",
            id: "L1",
            sourceKey: "b",
            operator: "eq",
            value: "2"
          }
        ]
      }
    ]
  };
}

describe("condition tree mutators", () => {
  it("updates a nested child at depth two without touching siblings", () => {
    const root = tree();

    const next = updateAtPath(root, [1, 0], current => current.kind === "leaf" ? { ...current, value: "9" } : current) as LinkageConditionGroup;

    expect((next.children[1] as LinkageConditionGroup).children[0]).toMatchObject({ id: "L1", value: "9" });
    // Untouched branches keep their identity (structural sharing).
    expect(next.children[0]).toBe(root.children[0]);
    expect(root).toEqual(tree());
  });

  it("returns the root unchanged when the path points into a non-group", () => {
    const root = tree();

    // children[0] is a leaf — descending into it is a no-op, not a crash.
    expect(updateAtPath(root, [0, 0], () => createLeaf("c"))).toEqual(root);
  });

  it("removes a nested child at depth two", () => {
    const next = removeAtPath(tree(), [1, 0]) as LinkageConditionGroup;

    expect((next.children[1] as LinkageConditionGroup).children).toEqual([]);
    expect(next.children).toHaveLength(2);
  });

  it("returns a non-group root unchanged on removal", () => {
    const leaf: LinkageCondition = createLeaf("a");

    expect(removeAtPath(leaf, [0])).toBe(leaf);
  });

  it("appends a child to the addressed group", () => {
    const next = appendChild(tree(), [1], createLeaf("c")) as LinkageConditionGroup;

    expect((next.children[1] as LinkageConditionGroup).children).toHaveLength(2);
  });

  it("ignores appendChild onto a non-group", () => {
    const root = tree();

    expect(appendChild(root, [0], createLeaf("c"))).toEqual(root);
  });
});

describe("setActionValueMode", () => {
  it("keeps the current value when the mode is unchanged", () => {
    const literal = { kind: "literal", value: "x" } as const;

    expect(setActionValueMode(literal, "literal")).toBe(literal);
  });

  it("resets the payload when switching modes both ways", () => {
    const literal = { kind: "literal", value: "x" } as const;

    const expression = setActionValueMode(literal, "expression");
    expect(expression).toEqual({ kind: "expression", source: "" });

    expect(setActionValueMode(expression, "literal")).toEqual({ kind: "literal", value: "" });
  });
});

describe("conditionHasAuthoredContent", () => {
  it("treats an empty group as unauthored", () => {
    expect(conditionHasAuthoredContent(createGroup([]))).toBe(false);
  });

  it("treats a group with one pristine seeded leaf as unauthored", () => {
    const group = createGroup([createLeaf("a")]);
    expect(conditionHasAuthoredContent(group)).toBe(false);
  });

  it("detects an authored leaf value", () => {
    const group = createGroup([{ ...createLeaf("a"), value: "10" }]);

    expect(conditionHasAuthoredContent(group)).toBe(true);
  });

  it("detects a non-default operator", () => {
    const group = createGroup([createLeaf("a", "notEmpty")]);

    expect(conditionHasAuthoredContent(group)).toBe(true);
  });

  it("treats multiple children as authored", () => {
    const group = createGroup([createLeaf("a"), createLeaf("b")]);
    expect(conditionHasAuthoredContent(group)).toBe(true);
  });

  it("keys an expression off a non-blank source", () => {
    expect(conditionHasAuthoredContent({ kind: "expression", source: "  " })).toBe(false);
    expect(conditionHasAuthoredContent({ kind: "expression", source: "field.a > 1" })).toBe(true);
  });
});
