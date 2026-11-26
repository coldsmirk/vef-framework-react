import type { FieldLinkageAction, FieldLinkageRule } from "../../../../types";

import { describe, expect, it } from "vitest";

import {
  actionKey,
  applyOutputDrafts,
  collectEffectiveOutputNames,
  computeOutputErrors,
  hasPendingOutputEdits,
  hasStepOutput,
  pruneOutputDrafts,
  stepOutputError
} from "./step-output-drafts";

function apiCall(id: string, output?: string): FieldLinkageAction {
  return {
    id,
    type: "api_call",
    request: { resource: "md/staff", action: "lookup" },
    ...output !== undefined && { output }
  };
}

function selectRecord(id: string, sourcePath: string, output: string): FieldLinkageAction {
  return {
    id,
    type: "select_record",
    source: { kind: "reference", path: sourcePath },
    output
  };
}

function setFields(id: string, targetKey: string, sourcePath: string): FieldLinkageAction {
  return {
    id,
    type: "set_fields",
    assignments: [{ targetKey, value: { kind: "reference", path: sourcePath } }]
  };
}

describe("step-output-drafts", () => {
  it("classifies output-producing steps and resolves stable action keys", () => {
    const api = apiCall("A1", "result");
    const select = selectRecord("A2", "$steps.result", "selected");
    const write = setFields("A3", "name", "$steps.selected.name");

    expect(hasStepOutput(api)).toBe(true);
    expect(hasStepOutput(select)).toBe(true);
    expect(hasStepOutput(write)).toBe(false);
    expect(actionKey(api, 0)).toBe("A1");
    expect(actionKey({ type: "show" }, 2)).toBe("action-2");
  });

  it("requires a non-empty valid identifier for select_record while allowing empty output on api_call", () => {
    const actions = [apiCall("A1", ""), selectRecord("A2", "$steps.result", "")];
    const { byKey, firstInvalidIndex } = computeOutputErrors(actions, {});

    expect(byKey.has("A1")).toBe(false);
    expect(byKey.get("A2")).toContain("请填写结果名");
    expect(firstInvalidIndex).toBe(1);

    expect(stepOutputError("1bad", false, new Set())).toContain("以字母或下划线开头");
    expect(stepOutputError("good_1", true, new Set())).toBeNull();
  });

  it("blames the drafted step when typing a duplicate of a committed earlier step", () => {
    const actions = [apiCall("A1", "result"), selectRecord("A2", "$steps.result", "selected")];
    const { byKey, firstInvalidIndex } = computeOutputErrors(actions, { A2: "result" });

    expect(byKey.has("A1")).toBe(false);
    expect(byKey.get("A2")).toContain("结果名「result」与本规则其它步骤重复");
    expect(firstInvalidIndex).toBe(1);
  });

  it("blames the later step for two pre-existing committed duplicates", () => {
    const actions = [apiCall("A1", "dup"), apiCall("A2", "dup")];
    const { byKey, firstInvalidIndex } = computeOutputErrors(actions, {});

    expect(byKey.has("A1")).toBe(false);
    expect(byKey.get("A2")).toContain("dup");
    expect(firstInvalidIndex).toBe(1);
  });

  it("collects effective output names preferring uncommitted drafts over stored values", () => {
    const actions = [apiCall("A1", "result"), selectRecord("A2", "$steps.result", "selected")];

    expect(collectEffectiveOutputNames(actions, { A1: "staff" }, 1)).toEqual(new Set(["staff"]));
    expect(collectEffectiveOutputNames(actions, { A1: "" }, 1)).toEqual(new Set());
  });

  it("prunes drafts for deleted or retyped steps while preserving reference identity when unchanged", () => {
    const drafts = { A1: "staff", A2: "picked" };
    const both = [apiCall("A1", "result"), selectRecord("A2", "$steps.result", "selected")];

    expect(pruneOutputDrafts(both, drafts)).toBe(drafts);

    // Step A2 deleted.
    expect(pruneOutputDrafts([apiCall("A1", "result")], drafts)).toEqual({ A1: "staff" });

    // Step A2 retyped to a non-output action keeping the same id.
    expect(pruneOutputDrafts([apiCall("A1", "result"), setFields("A2", "name", "$steps.result.name")], drafts))
      .toEqual({ A1: "staff" });
  });

  it("tracks whether pending drafts differ from stored output names", () => {
    const actions = [apiCall("A1", "result"), selectRecord("A2", "$steps.result", "selected")];

    expect(hasPendingOutputEdits(actions, {})).toBe(false);
    expect(hasPendingOutputEdits(actions, { A1: "result" })).toBe(false);
    expect(hasPendingOutputEdits(actions, { A1: "staff" })).toBe(true);
  });

  it("propagates output renames to downstream step references on apply", () => {
    const rule: FieldLinkageRule = {
      id: "R1",
      trigger: { kind: "commit" },
      actions: [
        apiCall("A1", "result"),
        selectRecord("A2", "$steps.result", "selected"),
        setFields("A3", "name", "$steps.selected.name")
      ]
    };

    expect(applyOutputDrafts(rule, { A1: "result" })).toBe(rule);

    const applied = applyOutputDrafts(rule, { A1: "rows", A2: "picked" });

    expect(applied.actions[0]).toMatchObject({ output: "rows" });
    expect(applied.actions[1]).toMatchObject({
      source: { kind: "reference", path: "$steps.rows" },
      output: "picked"
    });
    expect(applied.actions[2]).toMatchObject({
      assignments: [{ targetKey: "name", value: { kind: "reference", path: "$steps.picked.name" } }]
    });
  });

  it("clears optional api_call output when an empty draft is applied", () => {
    const rule: FieldLinkageRule = {
      id: "R1",
      trigger: { kind: "commit" },
      actions: [apiCall("A1", "result")]
    };

    const applied = applyOutputDrafts(rule, { A1: "" });

    expect(applied.actions[0]).not.toHaveProperty("output");
  });
});
