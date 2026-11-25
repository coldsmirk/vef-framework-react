import type { FieldLinkageAction, LinkageActionType } from "../../types";

import { describe, expect, it } from "vitest";

import {
  ACTION_DESCRIPTORS,
  getActionDataSourceId,
  getActionDynamicValues,
  getActionOutput,
  getActionRequests,
  getActionTargetKeys,
  getActionVariable,
  LINKAGE_ACTION_TYPES,
  mapActionDynamicValues,
  mapActionTargetKeys,
  rewriteActionVariable
} from "./index";

describe("ACTION_DESCRIPTORS", () => {
  it("declares a descriptor for every LinkageActionType", () => {
    const described = Object.keys(ACTION_DESCRIPTORS).toSorted();
    const expected = [...LINKAGE_ACTION_TYPES].toSorted();

    expect(described).toEqual(expected);
  });

  it("extracts and transforms dynamic values, targets, outputs, requests, variables, and data sources uniformly", () => {
    const apiAction: FieldLinkageAction = {
      type: "api_call",
      request: {
        resource: "hr/staff",
        action: "find",
        params: {
          code: { kind: "reference", path: "$form.code" }
        }
      },
      output: "res"
    };
    const selectAction: FieldLinkageAction = {
      type: "select_record",
      source: { kind: "reference", path: "$steps.res" },
      output: "picked"
    };
    const setFieldsAction: FieldLinkageAction = {
      type: "set_fields",
      assignments: [
        { targetKey: "name", value: { kind: "reference", path: "$steps.picked.name" } },
        { targetKey: "dept", value: { kind: "literal", value: "Ops" } }
      ]
    };
    const setVarAction: FieldLinkageAction = {
      type: "set_variable",
      variable: "count",
      value: { kind: "literal", value: 1 }
    };
    const refreshAction: FieldLinkageAction = {
      type: "refresh_data_source",
      dataSourceId: "ds1"
    };
    const assignAction: FieldLinkageAction = {
      type: "assign",
      value: { kind: "reference", path: "$form.code" }
    };

    expect(getActionRequests(apiAction)).toHaveLength(1);
    expect(getActionDynamicValues(apiAction)).toEqual([
      {
        path: "request.params.code",
        value: { kind: "reference", path: "$form.code" },
        allowSteps: true
      }
    ]);
    expect(getActionOutput(apiAction)).toEqual({
      path: "output",
      value: "res",
      required: false
    });

    expect(getActionDynamicValues(selectAction)).toEqual([
      {
        path: "source",
        value: { kind: "reference", path: "$steps.res" },
        allowSteps: true
      }
    ]);
    expect(getActionOutput(selectAction)).toEqual({
      path: "output",
      value: "picked",
      required: true
    });

    expect(getActionTargetKeys(setFieldsAction)).toEqual([
      { path: "assignments[0].targetKey", targetKey: "name" },
      { path: "assignments[1].targetKey", targetKey: "dept" }
    ]);
    expect(getActionDynamicValues(assignAction)[0]?.allowSteps).toBe(false);

    expect(getActionVariable(setVarAction)).toEqual({ path: "variable", value: "count" });
    expect(getActionDataSourceId(refreshAction)).toEqual({ path: "dataSourceId", value: "ds1" });

    // Structural rewrites preserve identity when unchanged and update or prune matched slots.
    expect(mapActionTargetKeys(setFieldsAction, key => key)).toBe(setFieldsAction);
    expect(mapActionTargetKeys(setFieldsAction, key => key === "name" ? "fullName" : key)).toEqual({
      type: "set_fields",
      assignments: [
        { targetKey: "fullName", value: { kind: "reference", path: "$steps.picked.name" } },
        { targetKey: "dept", value: { kind: "literal", value: "Ops" } }
      ]
    });

    expect(mapActionTargetKeys(setFieldsAction, key => key === "name" ? undefined : key)).toEqual({
      type: "set_fields",
      assignments: [{ targetKey: "dept", value: { kind: "literal", value: "Ops" } }]
    });
    expect(mapActionTargetKeys(setFieldsAction, () => undefined)).toBeUndefined();

    expect(mapActionDynamicValues(apiAction, value => value.kind === "reference"
      ? { kind: "reference", path: value.path.replace("$form.code", "$form.empCode") }
      : value)).toMatchObject({
      request: { params: { code: { kind: "reference", path: "$form.empCode" } } }
    });

    expect(rewriteActionVariable(setVarAction, "count", "total")).toEqual({
      type: "set_variable",
      variable: "total",
      value: { kind: "literal", value: 1 }
    });
    expect(rewriteActionVariable(setVarAction, "other", "total")).toBe(setVarAction);
  });

  it("keeps descriptor keys aligned with the LinkageActionType union", () => {
    const types: LinkageActionType[] = [...LINKAGE_ACTION_TYPES];

    for (const type of types) {
      expect(ACTION_DESCRIPTORS[type]).toBeDefined();
    }
  });
});
