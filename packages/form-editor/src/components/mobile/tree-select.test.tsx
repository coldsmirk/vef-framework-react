import type { TreeMultiSelectField, TreeSelectField } from "../../types";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataSourceProvider } from "../../render/data-source-context";
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

  it("keeps the full subtree when a parent and partial child both match, allows collapsing during search, and preserves browse expansion", async () => {
    const user = setupUser();
    const field = makeSingleField({
      showSearch: true,
      dataSource: {
        kind: "static",
        options: [
          {
            label: "华东大区",
            value: "east",
            children: [
              { label: "华东一区", value: "east-1" },
              { label: "上海市", value: "sh" }
            ]
          },
          {
            label: "华北大区",
            value: "north",
            children: [{ label: "北京市", value: "bj" }]
          }
        ]
      }
    });

    render(<MobileTreeSelectInput domId="field-mts" field={field} value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "区域" }));
    // Expand 华北大区 in browse mode before searching.
    await user.click(await screen.findByRole("button", { name: "展开 华北大区" }));
    expect(screen.getByText("北京市")).toBeInTheDocument();

    const searchInput = screen.getByRole("textbox", { name: "搜索选项" });
    await user.type(searchInput, "华东");

    // Both matching child (华东一区) and non-matching sibling (上海市) stay visible.
    expect(screen.getByText("华东一区")).toBeInTheDocument();
    expect(screen.getByText("上海市")).toBeInTheDocument();
    expect(screen.queryByText("华北大区")).not.toBeInTheDocument();

    // User can collapse the search-expanded parent while still searching.
    await user.click(screen.getByRole("button", { name: "收起 华东大区" }));
    expect(screen.queryByText("华东一区")).not.toBeInTheDocument();

    // Clearing search restores pre-search browse expansion (华北大区 still expanded, 华东大区 still collapsed).
    await user.click(screen.getByRole("button", { name: "清空搜索" }));
    expect(screen.getByText("北京市")).toBeInTheDocument();
    expect(screen.queryByText("上海市")).not.toBeInTheDocument();
  });

  it("auto-expands selected ancestors when remote options arrive while the popup is open", async () => {
    const user = setupUser();
    const { promise, resolve } = Promise.withResolvers<unknown[]>();
    const request = vi.fn().mockImplementation(() => promise);

    render(
      <DataSourceProvider request={request}>
        <MobileTreeSelectInput
          domId="field-mts"
          value="d2"
          field={makeSingleField({
            dataSource: {
              kind: "remote",
              request: { resource: "md/department", action: "find_flat_options" },
              mapping: {
                labelKey: "name",
                valueKey: "id",
                parentKey: "parentId"
              }
            }
          })}
          onChange={vi.fn()}
        />
      </DataSourceProvider>
    );

    await user.click(screen.getByRole("button", { name: "区域" }));
    resolve([
      {
        id: "d1",
        parentId: null,
        name: "总办"
      },
      {
        id: "d2",
        parentId: "d1",
        name: "档案室"
      }
    ]);

    const tree = await screen.findByRole("tree");
    expect(await within(tree).findByText("档案室")).toBeInTheDocument();
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
