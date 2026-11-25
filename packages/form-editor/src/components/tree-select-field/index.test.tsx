import type { FormDataSource, TreeSelectField } from "../../types";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataSourceProvider } from "../../render/data-source-context";
import { treeSelectFieldDefinition } from "./index";

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

function makeField(overrides: Partial<TreeSelectField> = {}): TreeSelectField {
  return {
    id: "Field_ts",
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

describe("tree-select field", () => {
  it("defines a keyed selection field with an empty static source", () => {
    expect(treeSelectFieldDefinition.config).toMatchObject({
      type: "tree-select",
      name: "树形选择",
      keyed: true,
      group: "selection"
    });
    expect(treeSelectFieldDefinition.config.create()).toEqual({
      type: "tree-select",
      label: "树形选择",
      dataSource: { kind: "static", options: [] }
    });
  });

  it("expands to the selected descendant on open, displays descriptions, and respects disabled nodes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const Component = treeSelectFieldDefinition.Component!;

    render(<Component domId="field-ts" field={makeField()} value="hz" onChange={onChange} />);

    // Trigger displays the selected leaf label, not description text.
    expect(screen.getByText("杭州市")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));

    // Ancestors of "hz" expand automatically so siblings and descriptions are visible.
    expect(await screen.findByText("华东片区")).toBeInTheDocument();
    expect(screen.getByText("省会城市")).toBeInTheDocument();
    expect(screen.getByText("暂停受理")).toBeInTheDocument();

    // Clicking a disabled option must not emit onChange.
    await user.click(screen.getByText("宁波市"));
    expect(onChange).not.toHaveBeenCalled();

    // Clicking an enabled option commits its scalar value.
    await user.click(screen.getByText("上海市"));
    expect(onChange).toHaveBeenLastCalledWith("sh");
  });

  it("expands branch nodes on click under leafOnly without selecting them, while allowing leaf selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const Component = treeSelectFieldDefinition.Component!;

    render(<Component domId="field-ts" field={makeField({ leafOnly: true })} value="" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("华东大区")).toBeInTheDocument();
    expect(screen.queryByText("上海市")).not.toBeInTheDocument();

    // Clicking a non-leaf branch under leafOnly expands it instead of committing a value.
    await user.click(screen.getByText("华东大区"));
    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByText("上海市")).toBeInTheDocument();

    // Clicking a leaf commits its value.
    await user.click(screen.getByText("华北大区"));
    expect(onChange).toHaveBeenLastCalledWith("north");
  });

  it("searches by label and description while keeping matching ancestors visible", async () => {
    const user = userEvent.setup();
    const Component = treeSelectFieldDefinition.Component!;

    render(<Component domId="field-ts" field={makeField({ showSearch: true })} value="" onChange={vi.fn()} />);

    const combobox = screen.getByRole<HTMLInputElement>("combobox");
    await user.click(combobox);
    await user.type(combobox, "省会");

    expect(await screen.findByText("杭州市")).toBeInTheDocument();
    expect(screen.getByText("华东大区")).toBeInTheDocument();
    expect(screen.queryByText("华北大区")).not.toBeInTheDocument();
  });

  it("lets the user expand a matched parent during search to pick a child without corrupting browse expansion", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const Component = treeSelectFieldDefinition.Component!;

    render(<Component domId="field-ts" field={makeField({ showSearch: true })} value="" onChange={onChange} />);

    const combobox = screen.getByRole<HTMLInputElement>("combobox");
    await user.click(combobox);

    // Manually expand 华东大区 in browse mode.
    const browseSwitcher = document.querySelector(".ant-select-tree-switcher_close");

    if (!browseSwitcher) {
      throw new Error("expected closed switcher in browse mode");
    }

    await user.click(browseSwitcher);
    expect(await screen.findByText("上海市")).toBeInTheDocument();

    // Search for the parent label alone: parent matches, children do not match.
    await user.type(combobox, "华东大区");
    expect(await screen.findByText("华东大区")).toBeInTheDocument();
    expect(screen.queryByText("上海市")).not.toBeInTheDocument();

    // Clicking the switcher during search must expand the matched parent so its children are reachable.
    const searchSwitcher = document.querySelector(".ant-select-tree-switcher_close");

    if (!searchSwitcher) {
      throw new Error("expected closed switcher on matched parent during search");
    }

    await user.click(searchSwitcher);
    expect(await screen.findByText("上海市")).toBeInTheDocument();

    // Collapsing during search and clearing search must preserve pre-search browse expansion.
    const openSearchSwitcher = document.querySelector(".ant-select-tree-switcher_open");

    if (!openSearchSwitcher) {
      throw new Error("expected open switcher during search");
    }

    await user.click(openSearchSwitcher);
    expect(screen.queryByText("上海市")).not.toBeInTheDocument();

    await user.clear(combobox);
    expect(await screen.findByText("上海市")).toBeInTheDocument();

    // Re-search, expand matched parent, and pick child.
    await user.type(combobox, "华东大区");
    const switcherAgain = document.querySelector(".ant-select-tree-switcher_close");

    if (!switcherAgain) {
      throw new Error("expected closed switcher on matched parent");
    }

    await user.click(switcherAgain);
    await user.click(await screen.findByText("上海市"));
    expect(onChange).toHaveBeenLastCalledWith("sh");
  });

  it("searches from the first character when typing opens the dropdown", async () => {
    const user = userEvent.setup();
    const Component = treeSelectFieldDefinition.Component!;

    render(<Component domId="field-ts" field={makeField({ showSearch: true })} value="" onChange={vi.fn()} />);

    await user.tab();
    await user.keyboard("华北");

    expect(screen.getByRole("combobox")).toHaveValue("华北");
    expect(await screen.findByText("华北大区")).toBeInTheDocument();
    expect(screen.queryByText("华东大区")).not.toBeInTheDocument();
  });

  it("makes the first row matching by label or description the active one", async () => {
    const user = userEvent.setup();
    const Component = treeSelectFieldDefinition.Component!;

    render(<Component domId="field-ts" field={makeField({ showSearch: true })} value="" onChange={vi.fn()} />);

    await user.tab();
    await user.keyboard("华北");
    expect(await screen.findByRole("tree")).toHaveAttribute("aria-activedescendant", screen.getByRole("treeitem", { name: "华北大区" }).id);

    await user.clear(screen.getByRole("combobox"));
    await user.keyboard("省会");
    expect(screen.getByRole("tree")).toHaveAttribute("aria-activedescendant", screen.getByRole("treeitem", { name: /杭州市/ }).id);
  });

  it("retains the full subtree when both a parent and a subset of its children match the search query", async () => {
    const user = userEvent.setup();
    const Component = treeSelectFieldDefinition.Component!;
    const field = makeField({
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
          { label: "华北大区", value: "north" }
        ]
      }
    });

    render(<Component domId="field-ts" field={field} value="" onChange={vi.fn()} />);

    const combobox = screen.getByRole<HTMLInputElement>("combobox");
    await user.click(combobox);
    await user.type(combobox, "华东");

    expect(await screen.findByText("华东一区")).toBeInTheDocument();
    expect(screen.getByText("上海市")).toBeInTheDocument();
    expect(screen.queryByText("华北大区")).not.toBeInTheDocument();
  });

  it("auto-expands selected ancestors when remote options arrive after the dropdown is already open", async () => {
    const user = userEvent.setup();
    const Component = treeSelectFieldDefinition.Component!;
    const { promise, resolve } = Promise.withResolvers<unknown[]>();
    const request = vi.fn().mockImplementation(() => promise);

    render(
      <DataSourceProvider request={request}>
        <Component
          domId="field-ts"
          value="d2"
          field={makeField({
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

    await user.click(screen.getByRole("combobox"));
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

  it("commits an empty string when cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const Component = treeSelectFieldDefinition.Component!;

    render(<Component domId="field-ts" field={makeField({ allowClear: true })} value="hz" onChange={onChange} />);

    const clear = document.querySelector(".ant-select-clear");

    if (!clear) {
      throw new Error("clear affordance not rendered");
    }

    await user.click(clear);

    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("displays an already-stored disabled option label and resolves ref and remote flat trees", async () => {
    const user = userEvent.setup();
    const Component = treeSelectFieldDefinition.Component!;
    const request = vi.fn().mockResolvedValue([
      {
        id: "d1",
        parentId: null,
        name: "总办",
        remark: "顶层"
      },
      {
        id: "d2",
        parentId: "d1",
        name: "档案室",
        inactive: true,
        remark: "已停用"
      }
    ]);
    const dataSources: FormDataSource[] = [
      {
        id: "ds-remote",
        name: "部门树",
        kind: "remote",
        request: { resource: "md/department", action: "find_flat_options" },
        mapping: {
          labelKey: "name",
          valueKey: "id",
          parentKey: "parentId",
          disabledKey: "inactive",
          descriptionKey: "remark"
        }
      }
    ];

    render(
      <DataSourceProvider dataSources={dataSources} request={request}>
        <Component
          domId="field-ts"
          field={makeField({ dataSource: { kind: "ref", dataSourceId: "ds-remote" } })}
          value="d2"
          onChange={vi.fn()}
        />
      </DataSourceProvider>
    );

    expect(await screen.findByText("档案室")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("已停用")).toBeInTheDocument();
  });

  it("shows load failure feedback when remote options reject", async () => {
    const user = userEvent.setup();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(Function.prototype as () => void);
    const request = vi.fn().mockRejectedValue(new Error("boom"));
    const Component = treeSelectFieldDefinition.Component!;

    render(
      <DataSourceProvider request={request}>
        <Component
          domId="field-ts"
          field={makeField({ dataSource: { kind: "remote", request: { resource: "md/department", action: "fail" } } })}
          value=""
          onChange={vi.fn()}
        />
      </DataSourceProvider>
    );

    await waitFor(() => expect(document.querySelector(".ant-select-status-error")).not.toBeNull());
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("选项加载失败")).toBeInTheDocument();
    consoleWarn.mockRestore();
  });
});
