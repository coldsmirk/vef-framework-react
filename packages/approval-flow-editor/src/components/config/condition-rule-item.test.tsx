import type { FC } from "react";

import type { EditorPlugins, PickerProps } from "../../plugins";
import type { ConditionDefinition, ConditionOperator } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EditorPluginsContext } from "../../plugins";
import { ConditionRuleItem } from "./condition-rule-item";

/**
 * Stand-in for a host picker: renders one button per selectable id and reports
 * the accumulated selection, which is what the real pickers do through antd.
 */
function stubPicker(ids: string[]): FC<PickerProps> {
  return ({ value, onChange }) => (
    <div>
      {ids.map(id => (
        <button key={id} type="button" onClick={() => onChange([...value, id])}>
          {`选择${id}`}
        </button>
      ))}
    </div>
  );
}

function condition(overrides: Partial<ConditionDefinition>): ConditionDefinition {
  return {
    kind: "field",
    subject: "applicantDepartmentId",
    operator: "eq",
    value: undefined,
    expression: "",
    ...overrides
  };
}

function renderRule(input: {
  condition: ConditionDefinition;
  plugins?: EditorPlugins;
  onChange?: (next: ConditionDefinition) => void;
}) {
  return render(
    <EditorPluginsContext value={input.plugins ?? {}}>
      <ConditionRuleItem
        condition={input.condition}
        readonly={false}
        onChange={input.onChange ?? (() => undefined)}
        onRemove={() => undefined}
      />
    </EditorPluginsContext>
  );
}

const DEPARTMENT_PLUGINS: EditorPlugins = {
  pickers: { department: stubPicker(["d1", "d2"]) }
};

const overlappingSubjects: EditorPlugins = {
  globalSubjects: [
    {
      key: "items",
      kind: "input",
      label: "项目"
    }
  ],
  formFields: [
    {
      key: "items",
      kind: "table",
      label: "项目",
      columns: [
        {
          key: "qty",
          kind: "number",
          label: "数量"
        },
        {
          key: "price",
          kind: "number",
          label: "单价"
        }
      ]
    }
  ]
};

describe("ConditionRuleItem aggregate subjects", () => {
  it("restores a form aggregate and edits its numeric column when a global has the same key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRule({
      condition: condition({
        subject: "items",
        operator: "gt",
        aggregate: "sum",
        column: "qty",
        value: 2
      }),
      plugins: overlappingSubjects,
      onChange
    });
    expect(screen.getByText("项目（明细表）")).toBeVisible();
    expect(screen.getByText("求和")).toBeVisible();
    expect(screen.getByText("数量")).toBeVisible();
    await user.click(screen.getByRole("combobox", { name: "聚合列" }));
    await user.click(await screen.findByText("单价"));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: "items",
      aggregate: "sum",
      column: "price"
    }));
    await user.click(screen.getByRole("combobox", { name: "条件字段" }));
    await user.click(await screen.findByText("项目（流程变量）"));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: "items",
      aggregate: undefined,
      column: undefined
    }));
  });

  it("offers the same-key form table separately when the current condition uses the scalar global", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRule({
      condition: condition({ subject: "items" }),
      plugins: overlappingSubjects,
      onChange
    });
    expect(screen.getByText("项目（流程变量）")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "聚合方式" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "条件字段" }));
    await user.click(await screen.findByText("项目（明细表）"));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: "items",
      aggregate: "count",
      column: undefined
    }));
  });

  it("omits global-only tables from the picker and keeps an unresolved aggregate visible", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRule({
      condition: condition({ subject: "runtimeItems", aggregate: "count" }),
      onChange,
      plugins: {
        globalSubjects: [
          {
            key: "runtimeItems",
            kind: "table",
            label: "全局明细"
          }
        ]
      }
    });
    expect(screen.getByText("runtimeItems")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "聚合方式" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "运算符" })).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "条件字段" }));
    const applicant = await screen.findByText("发起人 ID");
    expect(screen.queryByText("全局明细")).not.toBeInTheDocument();
    await user.click(applicant);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ subject: "applicantId", aggregate: undefined }));
  });
});

describe("ConditionRuleItem operator slot", () => {
  it("keeps the operator disabled until a subject is chosen", () => {
    renderRule({ condition: condition({ subject: "", operator: "" }) });

    expect(screen.getByRole("combobox", { name: "运算符" }), "a rule without a subject has no operator set to offer")
      .toBeDisabled();
  });

  it("keeps the operator disabled while the subject no longer resolves", () => {
    renderRule({ condition: condition({ subject: "removedField", operator: "gt" }) });

    expect(screen.getByRole("combobox", { name: "运算符" }), "a stale subject cannot interpret its stored operator")
      .toBeDisabled();
  });

  it("enables the operator once the subject resolves", () => {
    renderRule({ condition: condition({ operator: "" }) });

    expect(screen.getByRole("combobox", { name: "运算符" }), "a built-in subject offers its operator set")
      .toBeEnabled();
  });
});

describe("ConditionRuleItem built-in subject values", () => {
  it("supplies a built-in subject's value from the host picker", async () => {
    const onChange = vi.fn();
    renderRule({
      condition: condition({}),
      plugins: DEPARTMENT_PLUGINS,
      onChange
    });

    await userEvent.click(screen.getByRole("button", { name: "选择d1" }));

    expect(onChange, "picking a department stores its id as the condition value")
      .toHaveBeenCalledWith(expect.objectContaining({ value: "d1" }));
  });

  it("replaces rather than accumulates for a single-value operator", async () => {
    const onChange = vi.fn();
    renderRule({
      condition: condition({ value: "d1" }),
      plugins: DEPARTMENT_PLUGINS,
      onChange
    });

    await userEvent.click(screen.getByRole("button", { name: "选择d2" }));

    expect(onChange, "an equals rule compares one id, so the last pick wins")
      .toHaveBeenCalledWith(expect.objectContaining({ value: "d2" }));
  });

  it("keeps the array shape for a multi-value operator", async () => {
    const onChange = vi.fn();
    renderRule({
      condition: condition({ operator: "in", value: ["d1"] }),
      plugins: DEPARTMENT_PLUGINS,
      onChange
    });

    await userEvent.click(screen.getByRole("button", { name: "选择d2" }));

    expect(onChange, "an 属于 rule carries every picked id")
      .toHaveBeenCalledWith(expect.objectContaining({ value: ["d1", "d2"] }));
  });

  it("falls back to the text input when the host wired no picker", () => {
    renderRule({ condition: condition({}) });

    expect(screen.getByPlaceholderText("请输入值"), "a missing picker must not leave the rule unfillable")
      .toBeInTheDocument();
  });

  it("keeps the text input for substring operators", () => {
    renderRule({
      condition: condition({ operator: "contains" as ConditionOperator }),
      plugins: DEPARTMENT_PLUGINS
    });

    expect(screen.getByPlaceholderText("请输入值"), "a picked id is whole, so 包含 stays free text")
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选择d1" }), "the picker cannot express a substring")
      .not
      .toBeInTheDocument();
  });

  it("leaves an ordinary form field on its own input", () => {
    renderRule({
      condition: condition({ subject: "amount", operator: "eq" }),
      plugins: {
        ...DEPARTMENT_PLUGINS,
        formFields: [
          {
            key: "amount",
            kind: "number",
            label: "金额"
          }
        ]
      }
    });

    expect(screen.getByPlaceholderText("请输入数值"), "only the built-in subjects are picker-backed")
      .toBeInTheDocument();
  });
});

describe("ConditionRuleItem expression rules", () => {
  it("shows an expression condition as its source instead of an unfilled field rule", () => {
    renderRule({
      condition: condition({
        kind: "expression",
        subject: "",
        operator: "",
        expression: "formData.amount > 1000"
      })
    });

    expect(screen.getByRole("textbox", { name: "条件表达式" })).toHaveValue("formData.amount > 1000");
    expect(screen.queryByRole("combobox", { name: "条件字段" })).not.toBeInTheDocument();
  });

  it("edits the expression in place", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderRule({
      condition: condition({
        kind: "expression",
        subject: "",
        operator: "",
        expression: ""
      }),
      onChange
    });
    await user.type(screen.getByRole("textbox", { name: "条件表达式" }), "x");

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "expression", expression: "x" }));
  });
});

describe("ConditionRuleItem multi-value select fields", () => {
  const multiSelectPlugins: EditorPlugins = {
    formFields: [
      {
        key: "skills",
        kind: "select",
        label: "技能",
        isMultiple: true,
        options: [
          { label: "Go", value: "go" },
          { label: "Rust", value: "rust" }
        ]
      }
    ]
  };

  it("offers element-membership and emptiness operators instead of eq / in", async () => {
    const user = userEvent.setup();

    renderRule({
      condition: condition({ subject: "skills", operator: "" }),
      plugins: multiSelectPlugins
    });

    await user.click(screen.getByRole("combobox", { name: "运算符" }));

    expect(await screen.findByText("包含")).toBeInTheDocument();
    expect(screen.getByText("不包含")).toBeInTheDocument();
    expect(screen.getByText("为空")).toBeInTheDocument();
    expect(screen.getByText("不为空")).toBeInTheDocument();
    expect(screen.queryByText("等于")).not.toBeInTheDocument();
    expect(screen.queryByText("属于")).not.toBeInTheDocument();
  });

  it("offers the single-option picker for contains on a multi-value select", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderRule({
      condition: condition({
        subject: "skills",
        operator: "contains",
        value: undefined
      }),
      plugins: multiSelectPlugins,
      onChange
    });

    // Value slot renders a single-select option picker beside the field and operator comboboxes.
    const comboboxes = screen.getAllByRole("combobox");
    await user.click(comboboxes.at(-1)!);
    await user.click(await screen.findByText("Rust"));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: "skills",
      operator: "contains",
      value: "rust"
    }));
  });
});

describe("ConditionRuleItem date, datetime, and daterange fields", () => {
  const temporalPlugins: EditorPlugins = {
    formFields: [
      {
        key: "billingMonth",
        kind: "date",
        label: "账期",
        granularity: "month"
      },
      {
        key: "fiscalQuarter",
        kind: "date",
        label: "季度",
        granularity: "quarter"
      },
      {
        key: "meetingAt",
        kind: "datetime",
        label: "会议时间"
      },
      {
        key: "leaveSpan",
        kind: "daterange",
        label: "请假区间",
        granularity: "day"
      }
    ]
  };

  it("hydrates and commits canonical month values for a month-granularity date field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderRule({
      condition: condition({
        subject: "billingMonth",
        operator: "gte",
        value: "2026-04"
      }),
      plugins: temporalPlugins,
      onChange
    });

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("2026-04");

    await user.click(input);
    await user.clear(input);
    await user.type(input, "2026-09{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: "billingMonth",
      operator: "gte",
      value: "2026-09"
    }));
  });

  it("hydrates canonical quarter values for a quarter-granularity date field", () => {
    renderRule({
      condition: condition({
        subject: "fiscalQuarter",
        operator: "eq",
        value: "2026-Q3"
      }),
      plugins: temporalPlugins
    });

    expect(screen.getByRole("textbox")).toHaveValue("2026-Q3");
  });

  it("hydrates and commits canonical datetime values for a datetime field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderRule({
      condition: condition({
        subject: "meetingAt",
        operator: "gt",
        value: "2026-04-15 09:30:00"
      }),
      plugins: temporalPlugins,
      onChange
    });

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("2026-04-15 09:30:00");

    await user.click(input);
    await user.clear(input);
    await user.type(input, "2026-05-01 14:00:00{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: "meetingAt",
      operator: "gt",
      value: "2026-05-01 14:00:00"
    }));
  });

  it("offers only emptiness operators and no value input for a daterange field", async () => {
    const user = userEvent.setup();

    renderRule({
      condition: condition({
        subject: "leaveSpan",
        operator: "is_not_empty",
        value: undefined
      }),
      plugins: temporalPlugins
    });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "运算符" }));

    expect(await screen.findByText("为空")).toBeInTheDocument();
    expect(screen.queryByText("等于")).not.toBeInTheDocument();
    expect(screen.queryByText("大于")).not.toBeInTheDocument();
  });
});
