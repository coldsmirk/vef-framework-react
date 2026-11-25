import type { DataSourceApi, FieldLinkageAction, KeyedFormField, TextfieldField } from "../../types";
import type { WritableTargetField } from "./validator";

import { describe, expect, it } from "vitest";

import {
  collectInferredSelectRecordColumns,
  collectStepOutputNames,
  findBrokenStepReferences,
  findDependentStepsAfter,
  matchStepFieldsToTargets,
  nextUniqueStepOutput,
  renameStepOutputInRule,
  resolvePriorStepSchemas,
  resolveRecordSourceFields
} from "./step-schema";

const STAFF_API: DataSourceApi = {
  label: "职员查询",
  resource: "md/staff",
  action: "lookup",
  fields: [
    { path: "number", label: "工号" },
    { path: "name", label: "姓名" },
    { path: "phoneNumber", label: "手机号" },
    { path: "profile.email", label: "邮箱" }
  ]
};

function textField(key: string, label: string): TextfieldField {
  return {
    id: `Field_${key}`,
    type: "textfield",
    key,
    label
  };
}

function lookupSequence(): FieldLinkageAction[] {
  return [
    {
      id: "A1",
      type: "api_call",
      request: {
        resource: "md/staff",
        action: "lookup",
        params: { keyword: { kind: "reference", path: "staffNo" } }
      },
      output: "result"
    },
    {
      id: "A2",
      type: "select_record",
      source: { kind: "reference", path: "$steps.result" },
      output: "selected",
      whenNone: "continue"
    },
    {
      id: "A3",
      type: "set_fields",
      assignments: [
        { targetKey: "name", value: { kind: "reference", path: "$steps.selected.name" } },
        { targetKey: "phone", value: { kind: "reference", path: "$steps.selected.phoneNumber" } }
      ]
    }
  ];
}

describe("step-schema helpers", () => {
  it("mints rule-unique step output names", () => {
    const actions = lookupSequence();

    expect([...collectStepOutputNames(actions)]).toEqual(["result", "selected"]);
    expect(nextUniqueStepOutput(actions, "result")).toBe("result_2");
    expect(nextUniqueStepOutput(actions, "selected")).toBe("selected_2");
    expect(nextUniqueStepOutput(actions, "result", 0)).toBe("result");
  });

  it("renames a step output and propagates to all subsequent references", () => {
    const renamedFirst = renameStepOutputInRule(lookupSequence(), 0, "staffRows");

    expect(renamedFirst[0]).toMatchObject({ type: "api_call", output: "staffRows" });
    expect(renamedFirst[1]).toMatchObject({
      type: "select_record",
      source: { kind: "reference", path: "$steps.staffRows" }
    });

    const renamedSecond = renameStepOutputInRule(renamedFirst, 1, "staff");

    expect(renamedSecond[1]).toMatchObject({ type: "select_record", output: "staff" });
    expect(renamedSecond[2]).toMatchObject({
      type: "set_fields",
      assignments: [
        { targetKey: "name", value: { kind: "reference", path: "$steps.staff.name" } },
        { targetKey: "phone", value: { kind: "reference", path: "$steps.staff.phoneNumber" } }
      ]
    });
  });

  it("drops the output key when clearing api_call output", () => {
    const cleared = renameStepOutputInRule(lookupSequence(), 0, "");

    expect(cleared[0]).not.toHaveProperty("output");
  });

  it("stops renaming at a step that redefines the old name", () => {
    const [call, select, fill] = lookupSequence();
    const redefined = { ...call!, id: "A4" };
    const renamed = renameStepOutputInRule([call!, redefined, select!, fill!], 0, "first");

    expect(renamed[0]).toMatchObject({ output: "first" });
    expect(renamed[1]).toMatchObject({ output: "result" });
    expect(renamed[2]).toMatchObject({ source: { kind: "reference", path: "$steps.result" } });
  });

  it("finds dependent subsequent steps and reorder violations", () => {
    const actions = lookupSequence();

    expect(findDependentStepsAfter(actions, 0)).toEqual([1]);
    expect(findDependentStepsAfter(actions, 1)).toEqual([2]);
    expect(findDependentStepsAfter(actions, 2)).toEqual([]);

    // Moving api_call after select_record breaks $steps.result.
    const reordered = [actions[1]!, actions[0]!, actions[2]!];
    expect(findBrokenStepReferences(reordered)).toEqual([
      {
        stepName: "result",
        producerIndex: 1,
        consumerIndex: 0
      }
    ]);
    expect(findBrokenStepReferences(actions)).toEqual([]);
  });

  it("propagates declared API fields from api_call through select_record", () => {
    const actions = lookupSequence();
    const priorBeforeSetFields = resolvePriorStepSchemas(actions, 2, [STAFF_API]);

    expect(priorBeforeSetFields).toHaveLength(2);
    expect(priorBeforeSetFields[0]).toMatchObject({
      output: "result",
      label: "职员查询",
      fields: STAFF_API.fields
    });
    expect(priorBeforeSetFields[1]).toMatchObject({
      output: "selected",
      label: "职员查询 · 选中记录",
      fields: STAFF_API.fields
    });

    expect(resolveRecordSourceFields({ kind: "reference", path: "$steps.result" }, priorBeforeSetFields)).toEqual(STAFF_API.fields);
    expect(resolveRecordSourceFields({ kind: "reference", path: "$steps.result.profile" }, priorBeforeSetFields)).toEqual([{ path: "email", label: "邮箱" }]);
    expect(resolveRecordSourceFields({ kind: "reference", path: "name" }, priorBeforeSetFields)).toEqual([]);
  });

  it("previews inferred select_record columns from downstream set_fields", () => {
    const actions = lookupSequence();
    const scopeFields = new Map<string, KeyedFormField>([
      ["name", textField("name", "姓名")],
      ["phone", textField("phone", "联系电话")]
    ]);

    expect(collectInferredSelectRecordColumns("selected", actions.slice(2), scopeFields)).toEqual([
      { path: "name", label: "姓名" },
      { path: "phoneNumber", label: "联系电话" }
    ]);
  });

  it("matches step fields to unmapped writable targets by key then label without touching existing mappings", () => {
    const actions = lookupSequence();
    const prior = resolvePriorStepSchemas(actions, 2, [STAFF_API]);
    const selectedStep = prior[1]!;
    const targets: WritableTargetField[] = [
      textField("name", "姓名"),
      // matches last segment of profile.email
      textField("email", "联系地址"),
      // matches by label
      textField("contactTel", "手机号"),
      // unmatched
      textField("remark", "备注")
    ];

    // Existing mapping for `name` must be preserved untouched.
    const result = matchStepFieldsToTargets(selectedStep, targets, [{ targetKey: "name", value: { kind: "literal", value: "手动值" } }]);

    expect(result.added).toEqual([
      { targetKey: "email", value: { kind: "reference", path: "$steps.selected.profile.email" } },
      { targetKey: "contactTel", value: { kind: "reference", path: "$steps.selected.phoneNumber" } }
    ]);
    expect(result.nextAssignments).toEqual([
      { targetKey: "name", value: { kind: "literal", value: "手动值" } },
      ...result.added
    ]);
  });

  it("replaces a sole untouched blank row when auto-matching fields", () => {
    const actions = lookupSequence();
    const selectedStep = resolvePriorStepSchemas(actions, 2, [STAFF_API])[1]!;
    const result = matchStepFieldsToTargets(
      selectedStep,
      [textField("name", "姓名")],
      [{ targetKey: "", value: { kind: "literal", value: "" } }]
    );

    expect(result.nextAssignments).toEqual([{ targetKey: "name", value: { kind: "reference", path: "$steps.selected.name" } }]);
  });
});
