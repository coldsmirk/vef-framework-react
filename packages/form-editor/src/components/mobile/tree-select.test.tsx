import type { TreeMultiSelectField, TreeSelectField } from "../../types";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MobileTreeMultiSelectInput, MobileTreeSelectInput } from "./tree-select";

// antd-mobile's Popup drives pointer-events through a @react-spring animation
// that never completes under jsdom, so disable the CSS pointer-events guard
// while still dispatching real userEvent clicks.
function setupUser(): ReturnType<typeof userEvent.setup> {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

const TREE_OPTIONS = [
  {
    label: "华东大区",
    value: "east",
    description: "华东片区",
    children: [
      {
        label: "浙江省",
        value: "zj",
        children: [
          {
            label: "杭州市",
            value: "hz",
            description: "省会城市"
          },
          {
            label: "宁波市",
            value: "nb",
            disabled: true,
            description: "暂停受理"
          }
        ]
      },
      {
        label: "上海市",
        value: "sh",
        description: "直辖市"
      }
    ]
  },
  { label: "华北大区", value: "north" }
];

function makeSingleField(overrides: Partial<TreeSelectField> = {}): TreeSelectField {
  return {
    id: "Field_mts",
    type: "tree-select",
    key: "region",
    label: "区域",
    dataSource: {
      kind: "static",
      options: TREE_OPTIONS
    },
    ...overrides
  };
}

function makeMultiField(overrides: Partial<TreeMultiSelectField> = {}): TreeMultiSelectField {
  return {
    id: "Field_mtms",
    type: "tree-multi-select",
    key: "regions",
    label: "覆盖区域",
    dataSource: {
      kind: "static",
      options: TREE_OPTIONS
    },
    ...overrides
  };
}

describe("MobileTreeSelectInput", () => {
  it("displays selected descendant label, raw fallback for missing values, and clears to empty string", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <MobileTreeSelectInput domId="field-mts" field={makeSingleField({ allowClear: true })} value="hz" onChange={onChange} />
    );

    expect(screen.getByText("杭州市")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "清除" }));
    expect(onChange).toHaveBeenCalledWith("");

    rerender(
      <MobileTreeSelectInput domId="field-mts" field={makeSingleField()} value="retired_region" onChange={onChange} />
    );
    expect(screen.getByText("retired_region")).toBeInTheDocument();
  });

  it("expands branches, taps to commit immediately, blocks disabled nodes, and honors leafOnly", async () => {
    const user = setupUser();
    const onChange = vi.fn();

    render(
      <MobileTreeSelectInput
        domId="field-mts"
        field={makeSingleField({ leafOnly: true })}
        value={undefined}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "区域" }));
    expect(await screen.findByText("华东片区")).toBeInTheDocument();

    // Tapping a branch under leafOnly expands it instead of committing.
    await user.click(screen.getByRole("treeitem", { name: /华东大区/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByText("浙江省")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开 浙江省" }));
    expect(await screen.findByText("杭州市")).toBeInTheDocument();
    expect(screen.getByText("暂停受理")).toBeInTheDocument();

    // Disabled leaf cannot be selected.
    const disabledItem = screen.getByRole("treeitem", { name: /宁波市/ });
    expect(disabledItem).toBeDisabled();
    await user.click(disabledItem);
    expect(onChange).not.toHaveBeenCalled();

    // Enabled leaf commits immediately on tap.
    await user.click(screen.getByRole("treeitem", { name: /杭州市/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("hz"));
  });

  it("filters tree nodes by label and description when showSearch is enabled", async () => {
    const user = setupUser();

    render(
      <MobileTreeSelectInput
        domId="field-mts"
        field={makeSingleField({ showSearch: true })}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "区域" }));
    const searchInput = await screen.findByRole("textbox", { name: "搜索选项" });
    await user.type(searchInput, "省会");

    expect(screen.getByText("杭州市")).toBeInTheDocument();
    expect(screen.getByText("华东大区")).toBeInTheDocument();
    expect(screen.queryByText("华北大区")).not.toBeInTheDocument();
  });
});

describe("MobileTreeMultiSelectInput", () => {
  it("supports strict non-cascading multi-select committed on confirm and discards on cancel", async () => {
    const user = setupUser();
    const onChange = vi.fn();

    render(
      <MobileTreeMultiSelectInput
        domId="field-mtms"
        field={makeMultiField()}
        value={["east"]}
        onChange={onChange}
      />
    );

    expect(screen.getByText("华东大区")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "覆盖区域" }));
    await user.click(await screen.findByRole("button", { name: "展开 华东大区" }));
    await user.click(screen.getByRole("treeitem", { name: /上海市/ }));
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "覆盖区域" }));
    await user.click(await screen.findByRole("button", { name: "展开 华东大区" }));
    await user.click(screen.getByRole("treeitem", { name: /上海市/ }));
    await user.click(screen.getByRole("button", { name: "确定" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["east", "sh"]));
  });

  it("clears to [] when allowClear is enabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MobileTreeMultiSelectInput
        domId="field-mtms"
        field={makeMultiField({ allowClear: true })}
        value={["hz", "sh"]}
        onChange={onChange}
      />
    );

    expect(screen.getByText("杭州市、上海市")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "清除" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
