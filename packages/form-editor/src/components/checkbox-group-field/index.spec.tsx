import type { CheckboxGroupField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { checkboxGroupFieldDefinition } from "./index";

function makeField(overrides: Partial<CheckboxGroupField> = {}): CheckboxGroupField {
  return {
    id: "Field_c",
    type: "checkbox-group",
    key: "c",
    label: "城市",
    dataSource: {
      kind: "static",
      options: [
        { label: "北京", value: "bj" },
        { label: "上海", value: "sh" }
      ]
    },
    ...overrides
  };
}

describe("checkbox group field", () => {
  it("defines a keyed multi-select field with an empty static source", () => {
    expect(checkboxGroupFieldDefinition.config).toMatchObject({
      type: "checkbox-group",
      keyed: true,
      group: "selection"
    });
    expect(checkboxGroupFieldDefinition.config.create()).toEqual({
      type: "checkbox-group",
      label: "多选",
      dataSource: { kind: "static", options: [] }
    });
  });

  it("adds the checked value to the selection array", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = checkboxGroupFieldDefinition;

    if (!Component) {
      throw new Error("checkbox group field is missing a Component");
    }

    render(<Component domId="field-c" field={makeField()} value={[]} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: "上海" }));

    expect(onChange).toHaveBeenCalledWith(["sh"]);
  });

  it("lays the options in a row when direction is horizontal", () => {
    const { Component } = checkboxGroupFieldDefinition;

    if (!Component) {
      throw new Error("checkbox group field is missing a Component");
    }

    render(<Component domId="field-c" field={makeField({ direction: "horizontal" })} value={[]} onChange={vi.fn()} />);

    // The antd group root carries the layout style but exposes no accessible
    // handle; reach it through its documented class — the same node-access
    // exemption the canvas spec uses for unlabeled structural elements.
    // eslint-disable-next-line testing-library/no-node-access -- antd group root, no accessible handle
    const group = screen.getByRole("checkbox", { name: "上海" }).closest(".ant-checkbox-group");
    expect(group).not.toHaveStyle({ flexDirection: "column" });
  });

  it("stacks the options in a column when direction is vertical", () => {
    const { Component } = checkboxGroupFieldDefinition;

    if (!Component) {
      throw new Error("checkbox group field is missing a Component");
    }

    render(<Component domId="field-c" field={makeField({ direction: "vertical" })} value={[]} onChange={vi.fn()} />);

    // eslint-disable-next-line testing-library/no-node-access -- antd group root, no accessible handle
    const group = screen.getByRole("checkbox", { name: "上海" }).closest(".ant-checkbox-group");
    expect(group).toHaveStyle({ flexDirection: "column" });
  });

  it("shows an empty hint instead of a blank void when the source has no options", () => {
    const { Component } = checkboxGroupFieldDefinition;

    if (!Component) {
      throw new Error("checkbox group field is missing a Component");
    }

    render(
      <Component
        domId="field-c"
        field={makeField({ dataSource: { kind: "static", options: [] } })}
        value={[]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("暂无选项")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
