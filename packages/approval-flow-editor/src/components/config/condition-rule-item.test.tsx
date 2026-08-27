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
