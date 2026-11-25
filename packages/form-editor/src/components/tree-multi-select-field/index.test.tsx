import type { TreeMultiSelectField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { treeMultiSelectFieldDefinition } from "./index";

const TREE_OPTIONS = [
  {
    label: "研发中心",
    value: "rd",
    description: "研发总部门",
    children: [
      {
        label: "平台组",
        value: "platform",
        description: "基础平台"
      },
      {
        label: "归档组",
        value: "legacy",
        disabled: true,
        description: "已停用"
      }
    ]
  },
  { label: "运营中心", value: "ops" }
];

function makeField(overrides: Partial<TreeMultiSelectField> = {}): TreeMultiSelectField {
  return {
    id: "Field_tms",
    type: "tree-multi-select",
    key: "depts",
    label: "关联部门",
    dataSource: {
      kind: "static",
      options: TREE_OPTIONS
    },
    ...overrides
  };
}

describe("tree-multi-select field", () => {
  it("defines a keyed selection field with an empty static source", () => {
    expect(treeMultiSelectFieldDefinition.config).toMatchObject({
      type: "tree-multi-select",
      name: "树形多选",
      keyed: true,
      group: "selection"
    });
    expect(treeMultiSelectFieldDefinition.config.create()).toEqual({
      type: "tree-multi-select",
      label: "树形多选",
      dataSource: { kind: "static", options: [] }
    });
  });

  it("keeps parent and child checks strictly independent without cascading and emits plain value arrays", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const Component = treeMultiSelectFieldDefinition.Component!;

    render(<Component domId="field-tms" field={makeField()} value={["platform"]} onChange={onChange} />);

    // Trigger renders tag for selected leaf and keeps missing values visible too.
    expect(screen.getByText("平台组")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("研发总部门")).toBeInTheDocument();

    // Checking the parent branch selects ONLY the parent in addition to "platform" —
    // never cascades to disabled or unchecked children.
    await user.click(screen.getByText("研发中心"));
    expect(onChange).toHaveBeenLastCalledWith(["platform", "rd"]);
  });

  it("blocks checking branch nodes under leafOnly and prevents checking disabled nodes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const Component = treeMultiSelectFieldDefinition.Component!;

    render(<Component domId="field-tms" field={makeField({ leafOnly: true })} value={["platform"]} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("研发中心")).toBeInTheDocument();

    await user.click(screen.getByText("研发中心"));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByText("归档组"));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByText("运营中心"));
    expect(onChange).toHaveBeenLastCalledWith(["platform", "ops"]);
  });

  it("renders raw value tags for missing options and commits [] when cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const Component = treeMultiSelectFieldDefinition.Component!;

    render(
      <Component
        domId="field-tms"
        field={makeField({ allowClear: true })}
        value={["platform", "retired_code"]}
        onChange={onChange}
      />
    );

    expect(screen.getByText("平台组")).toBeInTheDocument();
    expect(screen.getByText("retired_code")).toBeInTheDocument();

    const clear = document.querySelector(".ant-select-clear");

    if (!clear) {
      throw new Error("clear affordance not rendered");
    }

    await user.click(clear);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("filters tree nodes by description when showSearch is enabled", async () => {
    const user = userEvent.setup();
    const Component = treeMultiSelectFieldDefinition.Component!;

    render(<Component domId="field-tms" field={makeField({ showSearch: true })} value={[]} onChange={vi.fn()} />);

    const combobox = screen.getByRole<HTMLInputElement>("combobox");
    await user.click(combobox);
    await user.type(combobox, "基础平台");

    expect(await screen.findByText("平台组")).toBeInTheDocument();
    expect(screen.getByText("研发中心")).toBeInTheDocument();
    expect(screen.queryByText("运营中心")).not.toBeInTheDocument();
  });
});
