import type { FieldLinkageRule, FormField } from "../../../../types";

import { createId } from "../../../../engine/ids";
import { isWritableTargetField } from "../../../../engine/linkage";
import { createGroup, createLeaf } from "./mutators";

export interface LinkageRuleTemplate {
  id: string;
  label: string;
  description: string;
  create: () => FieldLinkageRule;
}

/**
 * "查询并回填": when the field is committed and not empty, call an API, select
 * one of its records, and write fields from it. An ordinary rule — nothing
 * records that a template made it.
 */
export function createLookupAndFillRule(selfKey: string): FieldLinkageRule {
  return {
    id: createId("Rule"),
    trigger: {
      kind: "commit",
      when: createGroup([createLeaf(selfKey, "notEmpty")])
    },
    actions: [
      {
        id: createId("Action"),
        type: "api_call",
        request: { resource: "", action: "" },
        output: "result"
      },
      {
        id: createId("Action"),
        type: "select_record",
        source: { kind: "reference", path: "$steps.result" },
        output: "selected",
        whenNone: "continue"
      },
      {
        id: createId("Action"),
        type: "set_fields",
        assignments: [{ targetKey: "", value: { kind: "literal", value: "" } }]
      }
    ]
  };
}

/**
 * The ready-made rules a field's panel offers: those the field can trigger and
 * the host can run.
 */
export function buildFieldLinkageTemplates(field: FormField, hasRequest: boolean): LinkageRuleTemplate[] {
  if (!isWritableTargetField(field) || !hasRequest) {
    return [];
  }

  const selfKey = field.key;

  return [
    {
      id: "lookup-and-fill",
      label: "查询并回填",
      description: "输入完成 → 调用接口 → 选择记录 → 回填字段",
      create: () => createLookupAndFillRule(selfKey)
    }
  ];
}
