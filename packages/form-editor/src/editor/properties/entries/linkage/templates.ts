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
 * Pure factory for the "查询并回填" starter sequence:
 * commit (when self notEmpty)
 * 1. api_call → result
 * 2. select_record ($steps.result → selected, whenNone: "continue")
 * 3. set_fields (ready for "按名称匹配" or manual bindings)
 *
 * Produces an ordinary `FieldLinkageRule` with zero template marker — every
 * step is edited, reordered, and persisted identically to hand-authored rules.
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
 * Starter templates offered for a field's linkage panel. "查询并回填" is
 * offered only on writable leaf fields when the host wired `request` — a
 * non-writable field (button / divider / upload) or a host without `request`
 * cannot run the sequence.
 */
export function buildFieldLinkageTemplates(args: {
  field: FormField;
  hasRequest: boolean | undefined;
}): LinkageRuleTemplate[] {
  if (!isWritableTargetField(args.field) || args.hasRequest !== true) {
    return [];
  }

  const selfKey = args.field.key;

  return [
    {
      id: "lookup-and-fill",
      label: "查询并回填",
      description: "输入完成 → 调用接口 → 选择记录 → 回填字段",
      create: () => createLookupAndFillRule(selfKey)
    }
  ];
}
