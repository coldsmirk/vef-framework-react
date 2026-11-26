import type { DataSourceApi, FieldLinkageAction, KeyedFormField, LinkageContextSource, LinkageTrigger } from "../../../../types";
import type { ActionSummaryScope } from "./action-summary";
import type { TriggerSummaryScope } from "./trigger-summary";

import { summarizeRuleActions } from "./action-summary";
import { summarizeTrigger } from "./trigger-summary";

const FIELDS = new Map<string, Pick<KeyedFormField, "label">>([
  ["age", { label: "年龄" }],
  ["name", { label: "姓名" }],
  ["note", { label: "备注" }],
  ["amount", { label: "金额" }],
  ["number", { label: "工号" }]
]);

const CONTEXT_SOURCES: LinkageContextSource[] = [
  { key: "$applicant.departmentName", label: "发起人部门" },
  { key: "$globals.staffTitle", label: "发起人职称" }
];

const APIS: DataSourceApi[] = [
  {
    label: "职员查询",
    resource: "md/staff",
    action: "lookup"
  }
];

function triggerScope(ownerLabel?: string): TriggerSummaryScope {
  return {
    fieldsByKey: FIELDS,
    contextSources: CONTEXT_SOURCES,
    ownerLabel
  };
}

const ACTION_SCOPE: ActionSummaryScope = {
  fieldsByKey: FIELDS,
  contextSources: CONTEXT_SOURCES,
  dataSourceOptions: [{ value: "ds_dept", label: "部门列表" }]
};

describe("summarizeTrigger", () => {
  it("formats a single-leaf condition using the condition editor operator labels", () => {
    const trigger: LinkageTrigger = {
      kind: "condition",
      condition: {
        kind: "group",
        logic: "all",
        children: [
          {
            kind: "leaf",
            sourceKey: "age",
            operator: "gte",
            value: "18"
          }
        ]
      }
    };

    expect(summarizeTrigger(trigger, triggerScope("个人简介"))).toBe("年龄 大于等于 18 时");
  });

  it("formats value-less operators without a trailing value", () => {
    const trigger: LinkageTrigger = {
      kind: "condition",
      condition: {
        kind: "leaf",
        sourceKey: "note",
        operator: "notEmpty"
      }
    };

    expect(summarizeTrigger(trigger, triggerScope())).toBe("备注 不为空 时");
  });

  it("resolves system variables and form variables in condition sources", () => {
    const contextTrigger: LinkageTrigger = {
      kind: "condition",
      condition: {
        kind: "leaf",
        sourceKey: "$applicant.departmentName",
        operator: "eq",
        value: "财务部"
      }
    };
    const varTrigger: LinkageTrigger = {
      kind: "condition",
      condition: {
        kind: "leaf",
        sourceKey: "$vars.total",
        operator: "gt",
        value: "0"
      }
    };

    expect(summarizeTrigger(contextTrigger, triggerScope())).toBe("发起人部门 等于 财务部 时");
    expect(summarizeTrigger(varTrigger, triggerScope())).toBe("total 大于 0 时");
  });

  it("joins two conditions with 且 / 或 and summarizes three or more with count and logic", () => {
    const pair: LinkageTrigger = {
      kind: "condition",
      condition: {
        kind: "group",
        logic: "all",
        children: [
          {
            kind: "leaf",
            sourceKey: "age",
            operator: "gte",
            value: "18"
          },
          {
            kind: "leaf",
            sourceKey: "note",
            operator: "notEmpty"
          }
        ]
      }
    };
    const many: LinkageTrigger = {
      kind: "condition",
      condition: {
        kind: "group",
        logic: "any",
        children: [
          {
            kind: "leaf",
            sourceKey: "age",
            operator: "lt",
            value: "18"
          },
          {
            kind: "leaf",
            sourceKey: "name",
            operator: "empty"
          },
          {
            kind: "leaf",
            sourceKey: "amount",
            operator: "gt",
            value: "100"
          }
        ]
      }
    };

    expect(summarizeTrigger(pair, triggerScope())).toBe("年龄 大于等于 18 且 备注 不为空 时");
    expect(summarizeTrigger(many, triggerScope())).toBe("年龄 小于 18 等 3 项（任一） 时");
  });

  it("formats expression and empty condition triggers", () => {
    expect(summarizeTrigger({
      kind: "condition",
      condition: { kind: "expression", source: "field.age >= 18" }
    }, triggerScope())).toBe("满足表达式时");

    expect(summarizeTrigger({
      kind: "condition",
      condition: {
        kind: "group",
        logic: "all",
        children: []
      }
    }, triggerScope())).toBe("未配置条件");
  });

  it("formats field events with the owner label and optional when guard", () => {
    expect(summarizeTrigger({ kind: "commit" }, triggerScope("年龄"))).toBe("年龄 输入完成时");
    expect(summarizeTrigger({ kind: "change" }, triggerScope("年龄"))).toBe("年龄 值变化时");
    expect(summarizeTrigger({ kind: "focus" }, triggerScope("年龄"))).toBe("年龄 获得焦点时");
    expect(summarizeTrigger({ kind: "blur" }, triggerScope("年龄"))).toBe("年龄 失去焦点时");
    expect(summarizeTrigger({ kind: "click" }, triggerScope("提交"))).toBe("提交 点击时");
    expect(summarizeTrigger({
      kind: "commit",
      when: {
        kind: "group",
        logic: "all",
        children: [
          {
            kind: "leaf",
            sourceKey: "number",
            operator: "notEmpty"
          }
        ]
      }
    }, triggerScope("工号"))).toBe("工号 输入完成时 · 工号 不为空");
  });

  it("formats form lifecycle triggers without prepending an owner label", () => {
    expect(summarizeTrigger({ kind: "load" }, triggerScope("表单事件"))).toBe("表单加载时");
    expect(summarizeTrigger({ kind: "beforeSubmit" }, triggerScope("表单事件"))).toBe("表单提交前");
    expect(summarizeTrigger({
      kind: "afterSubmit",
      when: {
        kind: "leaf",
        sourceKey: "amount",
        operator: "gt",
        value: "0"
      }
    }, triggerScope("表单事件"))).toBe("表单提交后 · 金额 大于 0");
  });
});

describe("summarizeRuleActions", () => {
  it("delegates single-step rules to summarizeAction", () => {
    const actions: FieldLinkageAction[] = [
      {
        type: "alert",
        level: "info",
        message: { kind: "literal", value: "年龄已达标" }
      }
    ];

    expect(summarizeRuleActions(actions, ACTION_SCOPE, APIS)).toBe("提示消息 · 信息 · 年龄已达标");
  });

  it("summarizes multi-step rules with the step count and pipeline labels", () => {
    const actions: FieldLinkageAction[] = [
      {
        type: "api_call",
        request: { resource: "md/staff", action: "lookup" },
        output: "result"
      },
      {
        type: "select_record",
        source: { kind: "reference", path: "$steps.result" },
        output: "selected"
      },
      {
        type: "set_fields",
        assignments: [{ targetKey: "name", value: { kind: "reference", path: "$steps.selected.name" } }]
      }
    ];

    expect(summarizeRuleActions(actions, ACTION_SCOPE, APIS)).toBe("3 个步骤：调用接口 → 选择记录 → 设置字段");
  });

  it("reports empty action lists", () => {
    expect(summarizeRuleActions([], ACTION_SCOPE, APIS)).toBe("未配置步骤");
  });
});
