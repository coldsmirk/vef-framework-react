import type { DragEndEvent } from "@vef-framework-react/core";
import type { ReactElement } from "react";

import type { FieldOption } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import {
  OptionListEditor,
  parseBulkOptionLines,
  parseIndentedOptionLines
} from "./option-editors";
import { reorderRows } from "./sortable-rows";

interface HarnessProps {
  initial: FieldOption[];
  allowBulkPaste?: boolean;
  allowHierarchy?: boolean;
  onCommit?: (next: FieldOption[]) => void;
}

/**
 * Stateful round-trip harness mirroring the controlled usage in the
 * option-source entry and the data-source panel.
 */
function Harness({
  allowBulkPaste,
  allowHierarchy,
  initial,
  onCommit
}: HarnessProps): ReactElement {
  const [options, setOptions] = useState(initial);

  return (
    <OptionListEditor
      allowBulkPaste={allowBulkPaste}
      allowHierarchy={allowHierarchy}
      options={options}
      onChange={next => {
        onCommit?.(next);
        setOptions(next);
      }}
    />
  );
}

function threeOptions(): FieldOption[] {
  return [
    { label: "A", value: "a" },
    { label: "B", value: "b" },
    { label: "C", value: "c" }
  ];
}

/**
 * A minimal sortable drag-end event, populated with only the fields
 * `moveDragItem` reads: the source row's id and its projected `index`, a target,
 * and the cancel flag. Mirrors the fabricated-event approach in `dnd.test.tsx`.
 */
function reorderEvent(sourceId: string, toIndex: number, canceled = false): DragEndEvent {
  return {
    operation: {
      canceled,
      source: { id: sourceId, index: toIndex },
      target: { id: sourceId }
    }
  } as unknown as DragEndEvent;
}

describe("OptionListEditor", () => {
  describe("duplicate values", () => {
    it("surfaces duplicated option values as an inline warning", () => {
      render(
        <Harness
          initial={[
            { label: "北京", value: "bj" },
            { label: "北京2", value: "bj" }
          ]}
        />
      );

      expect(screen.getByText("选项值重复：bj")).toBeInTheDocument();
    });

    it("does not silently deduplicate the rows", () => {
      render(
        <Harness
          initial={[
            { label: "北京", value: "bj" },
            { label: "北京2", value: "bj" }
          ]}
        />
      );

      // Both rows stay editable; the warning is informational.
      expect(screen.getAllByDisplayValue("bj")).toHaveLength(2);
    });

    it("shows no warning for distinct values", () => {
      render(<Harness initial={threeOptions()} />);

      expect(screen.queryByText(/选项值重复/)).not.toBeInTheDocument();
    });
  });

  describe("reordering", () => {
    it("moves a row down", () => {
      const result = reorderRows(threeOptions(), ["r0", "r1", "r2"], reorderEvent("r0", 1));

      expect(result).toEqual({
        rows: [
          { label: "B", value: "b" },
          { label: "A", value: "a" },
          { label: "C", value: "c" }
        ],
        ids: ["r1", "r0", "r2"]
      });
    });

    it("moves a row up", () => {
      const result = reorderRows(threeOptions(), ["r0", "r1", "r2"], reorderEvent("r2", 1));

      expect(result).toEqual({
        rows: [
          { label: "A", value: "a" },
          { label: "C", value: "c" },
          { label: "B", value: "b" }
        ],
        ids: ["r0", "r2", "r1"]
      });
    });

    it("returns null when the drag is canceled", () => {
      expect(reorderRows(threeOptions(), ["r0", "r1", "r2"], reorderEvent("r0", 1, true))).toBeNull();
    });

    it("returns null when a row is dropped in its own slot", () => {
      expect(reorderRows(threeOptions(), ["r0", "r1", "r2"], reorderEvent("r0", 0))).toBeNull();
    });

    it("renders a drag handle per row and no step buttons", () => {
      render(<Harness initial={threeOptions()} />);

      expect(screen.getAllByRole("button", { name: "拖动排序" })).toHaveLength(3);
      expect(screen.queryByRole("button", { name: "上移选项" })).not.toBeInTheDocument();
    });
  });

  describe("row identity", () => {
    it("keeps a later row bound to the same DOM input when a middle row is removed", async () => {
      const user = userEvent.setup();

      render(<Harness initial={threeOptions()} />);

      const inputForC = screen.getByDisplayValue("C");
      const removeButtons = screen.getAllByRole("button", { name: "删除选项" });

      // Remove the middle row (B).
      await user.click(removeButtons[1] as HTMLElement);

      // Row C survives in the SAME input node — stable row keys, so editors
      // (and focus) stay pinned to their logical row across middle removals.
      expect(screen.getByDisplayValue("C")).toBe(inputForC);
      expect(screen.queryByDisplayValue("B")).not.toBeInTheDocument();
    });

    it("appends blank rows under values of their own", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={threeOptions()} onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: /添加选项/ }));
      await user.click(screen.getByRole("button", { name: /添加选项/ }));

      expect(onCommit).toHaveBeenLastCalledWith([
        ...threeOptions(),
        { label: "", value: "item_1" },
        { label: "", value: "item_2" }
      ]);
      expect(screen.queryByText(/选项值重复/)).not.toBeInTheDocument();
    });
  });

  describe("bulk paste", () => {
    it("parses trimmed non-blank lines into unique item_N options", () => {
      expect(parseBulkOptionLines("  虚构手术（8分） \n\n非卫生技术人员（10分）\r\n  ")).toEqual([
        { label: "虚构手术（8分）", value: "item_1" },
        { label: "非卫生技术人员（10分）", value: "item_2" }
      ]);
    });

    it("skips existing values when generating sequential item keys", () => {
      expect(parseBulkOptionLines("新条款A\n新条款B", new Set(["item_1", "item_3"]))).toEqual([
        { label: "新条款A", value: "item_2" },
        { label: "新条款B", value: "item_4" }
      ]);
    });

    it("imports and appends pasted lines when allowBulkPaste is enabled", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness allowBulkPaste initial={[{ label: "原项", value: "item_1" }]} onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: /批量粘贴/ }));
      await user.type(screen.getByRole("textbox", { name: "批量粘贴行项目" }), "条款甲\n条款乙");
      await user.click(screen.getByRole("button", { name: /追\s*加/ }));

      expect(onCommit).toHaveBeenLastCalledWith([
        { label: "原项", value: "item_1" },
        { label: "条款甲", value: "item_2" },
        { label: "条款乙", value: "item_3" }
      ]);

      await user.click(screen.getByRole("button", { name: /批量粘贴/ }));
      await user.type(screen.getByRole("textbox", { name: "批量粘贴行项目" }), "全新条款");
      await user.click(screen.getByRole("button", { name: "替换全部" }));

      expect(onCommit).toHaveBeenLastCalledWith([{ label: "全新条款", value: "item_1" }]);
    });
  });

  describe("metadata details (description and disabled)", () => {
    it("toggles option detail fields and persists description and disabled state", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={[{ label: "上海", value: "sh" }]} onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: "选项详情" }));
      await user.type(screen.getByRole("textbox", { name: "选项描述" }), "直辖市");
      expect(onCommit).toHaveBeenLastCalledWith([
        {
          label: "上海",
          value: "sh",
          description: "直辖市"
        }
      ]);

      await user.click(screen.getByRole("checkbox", { name: "禁用" }));
      expect(onCommit).toHaveBeenLastCalledWith([
        {
          label: "上海",
          value: "sh",
          description: "直辖市",
          disabled: true
        }
      ]);

      await user.click(screen.getByRole("checkbox", { name: "禁用" }));
      expect(onCommit).toHaveBeenLastCalledWith([
        {
          label: "上海",
          value: "sh",
          description: "直辖市"
        }
      ]);
    });
  });

  describe("hierarchy editing", () => {
    it("parses indented lines (spaces and tabs) into nested FieldOption trees with unique values", () => {
      const tree = parseIndentedOptionLines(
        "华东\n  浙江省\n    杭州市\n\t\t宁波市\n  上海市\n\n华北",
        new Set(["item_1"])
      );

      expect(tree).toEqual([
        {
          label: "华东",
          value: "item_2",
          children: [
            {
              label: "浙江省",
              value: "item_3",
              children: [
                { label: "杭州市", value: "item_4" },
                { label: "宁波市", value: "item_5" }
              ]
            },
            { label: "上海市", value: "item_6" }
          ]
        },
        { label: "华北", value: "item_7" }
      ]);
    });

    it("adds children, indents/outdents, moves siblings, collapses subtrees, and flags tree-wide duplicates", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <Harness
          allowHierarchy
          initial={[
            { label: "华东", value: "east" },
            { label: "上海", value: "sh" }
          ]}
          onCommit={onCommit}
        />
      );

      // Indent "上海" under "华东".
      const indentButtons = screen.getAllByRole("button", { name: "降级" });
      await user.click(indentButtons[1]!);

      expect(onCommit).toHaveBeenLastCalledWith([
        {
          label: "华东",
          value: "east",
          children: [{ label: "上海", value: "sh" }]
        }
      ]);

      // Collapse hides child; expand reveals it again.
      await user.click(screen.getByRole("button", { name: "折叠子项" }));
      expect(screen.queryByDisplayValue("上海")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "展开子项" }));
      expect(screen.getByDisplayValue("上海")).toBeInTheDocument();

      // Add a second child under "华东" and reorder it above "上海".
      const addChildButtons = screen.getAllByRole("button", { name: "添加子项" });
      await user.click(addChildButtons[0]!);
      expect(onCommit).toHaveBeenLastCalledWith([
        {
          label: "华东",
          value: "east",
          children: [
            { label: "上海", value: "sh" },
            { label: "", value: "item_1" }
          ]
        }
      ]);

      const moveUpButtons = screen.getAllByRole("button", { name: "上移" });
      await user.click(moveUpButtons[2]!);
      expect(onCommit).toHaveBeenLastCalledWith([
        {
          label: "华东",
          value: "east",
          children: [
            { label: "", value: "item_1" },
            { label: "上海", value: "sh" }
          ]
        }
      ]);

      // Outdent "上海" back to root level.
      const outdentButtons = screen.getAllByRole("button", { name: "升级" });
      await user.click(outdentButtons[2]!);
      expect(onCommit).toHaveBeenLastCalledWith([
        {
          label: "华东",
          value: "east",
          children: [{ label: "", value: "item_1" }]
        },
        { label: "上海", value: "sh" }
      ]);

      // Duplicate value across tree levels surfaces the inline warning.
      await user.clear(screen.getAllByPlaceholderText("值")[1]!);
      await user.type(screen.getAllByPlaceholderText("值")[1]!, "east");
      expect(screen.getByText("选项值重复：east")).toBeInTheDocument();
    });

    it("supports indented bulk paste append and replace in hierarchy mode", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <Harness
          allowHierarchy
          initial={[{ label: "原根节点", value: "item_1" }]}
          onCommit={onCommit}
        />
      );

      await user.click(screen.getByRole("button", { name: /批量粘贴/ }));
      await user.type(screen.getByRole("textbox", { name: "批量粘贴行项目" }), "华东\n  上海");
      await user.click(screen.getByRole("button", { name: /追\s*加/ }));

      expect(onCommit).toHaveBeenLastCalledWith([
        { label: "原根节点", value: "item_1" },
        {
          label: "华东",
          value: "item_2",
          children: [{ label: "上海", value: "item_3" }]
        }
      ]);
    });

    it("edits an already nested list as a hierarchy even where hierarchy is not offered", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <Harness
          initial={[
            {
              label: "甲区",
              value: "a",
              children: [{ label: "甲子项", value: "a1" }]
            }
          ]}
          onCommit={onCommit}
        />
      );

      expect(screen.getByRole("button", { name: "折叠子项" })).toBeInTheDocument();

      await user.type(screen.getByDisplayValue("甲子项"), "改");
      expect(onCommit).toHaveBeenLastCalledWith([
        {
          label: "甲区",
          value: "a",
          children: [{ label: "甲子项改", value: "a1" }]
        }
      ]);
    });

    it("keeps open detail drawers, collapse state, and DOM inputs pinned to logical rows across delete, move, indent, and outdent", async () => {
      const user = userEvent.setup();

      render(
        <Harness
          allowHierarchy
          initial={[
            { label: "甲区", value: "a" },
            {
              label: "乙区",
              value: "b",
              children: [{ label: "乙子项", value: "b1" }]
            },
            {
              label: "丙区",
              value: "c",
              description: "丙说明",
              children: [{ label: "丙子项", value: "c1" }]
            }
          ]}
        />
      );

      // Collapse 乙区 and open details on 丙区 (plus collapse 丙区 too after recording inputs).
      const inputForC = screen.getByDisplayValue("丙区");
      const foldButtons = screen.getAllByRole("button", { name: "折叠子项" });
      await user.click(foldButtons[0]!);
      expect(screen.queryByDisplayValue("乙子项")).not.toBeInTheDocument();

      // Open details on 丙区 (currently index 2 among visible rows: 甲区, 乙区, 丙区, 丙子项).
      const detailButtons = screen.getAllByRole("button", { name: "选项详情" });
      await user.click(detailButtons[2]!);
      const descInputForC = screen.getByDisplayValue("丙说明");

      // 1. Delete 甲区 — 乙区 stays collapsed and 丙区 keeps its open details & same DOM inputs.
      const removeButtons = screen.getAllByRole("button", { name: "删除选项" });
      await user.click(removeButtons[0]!);
      expect(screen.queryByDisplayValue("甲区")).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue("乙子项")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("丙区")).toBe(inputForC);
      expect(screen.getByDisplayValue("丙说明")).toBe(descInputForC);

      // 2. Move 丙区 up above 乙区 — 乙区 stays collapsed and 丙区 keeps its open details & DOM inputs.
      const moveUpButtons = screen.getAllByRole("button", { name: "上移" });
      await user.click(moveUpButtons[1]!);
      expect(screen.queryByDisplayValue("乙子项")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("丙子项")).toBeInTheDocument();
      expect(screen.getByDisplayValue("丙区")).toBe(inputForC);
      expect(screen.getByDisplayValue("丙说明")).toBe(descInputForC);

      // Move 丙区 back down, collapse 丙区, then indent under 乙区 — 丙区 stays collapsed with details open.
      await user.click(screen.getAllByRole("button", { name: "下移" })[0]!);
      await user.click(screen.getByRole("button", { name: "折叠子项" }));
      expect(screen.queryByDisplayValue("丙子项")).not.toBeInTheDocument();

      await user.click(screen.getAllByRole("button", { name: "降级" })[1]!);
      // Indenting under collapsed 乙区 uncollapses 乙区 (so 乙子项 and 丙区 appear),
      // while 丙区 itself remains collapsed and keeps its open detail drawer & DOM inputs.
      expect(screen.getByDisplayValue("乙子项")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("丙子项")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("丙区")).toBe(inputForC);
      expect(screen.getByDisplayValue("丙说明")).toBe(descInputForC);

      // 3. Outdent 丙区 back to root — still collapsed, details still open, same DOM inputs.
      // Visible order: 乙区(0), 乙子项(1), 丙区(2).
      await user.click(screen.getAllByRole("button", { name: "升级" })[2]!);
      expect(screen.queryByDisplayValue("丙子项")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("丙区")).toBe(inputForC);
      expect(screen.getByDisplayValue("丙说明")).toBe(descInputForC);
    });
  });
});
