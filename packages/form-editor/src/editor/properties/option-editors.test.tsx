import type { DragEndEvent } from "@vef-framework-react/core";
import type { ReactElement } from "react";

import type { FieldOption } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { OptionListEditor, parseBulkOptionLines, reorderOptionRows } from "./option-editors";

interface HarnessProps {
  initial: FieldOption[];
  allowBulkPaste?: boolean;
  onCommit?: (next: FieldOption[]) => void;
}

/**
 * Stateful round-trip harness mirroring the controlled usage in the
 * option-source entry and the data-source panel.
 */
function Harness({
  allowBulkPaste,
  initial,
  onCommit
}: HarnessProps): ReactElement {
  const [options, setOptions] = useState(initial);

  return (
    <OptionListEditor
      allowBulkPaste={allowBulkPaste}
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
      const result = reorderOptionRows(threeOptions(), ["r0", "r1", "r2"], reorderEvent("r0", 1));

      expect(result).toEqual({
        options: [
          { label: "B", value: "b" },
          { label: "A", value: "a" },
          { label: "C", value: "c" }
        ],
        rowIds: ["r1", "r0", "r2"]
      });
    });

    it("moves a row up", () => {
      const result = reorderOptionRows(threeOptions(), ["r0", "r1", "r2"], reorderEvent("r2", 1));

      expect(result).toEqual({
        options: [
          { label: "A", value: "a" },
          { label: "C", value: "c" },
          { label: "B", value: "b" }
        ],
        rowIds: ["r0", "r2", "r1"]
      });
    });

    it("returns null when the drag is canceled", () => {
      expect(reorderOptionRows(threeOptions(), ["r0", "r1", "r2"], reorderEvent("r0", 1, true))).toBeNull();
    });

    it("returns null when a row is dropped in its own slot", () => {
      expect(reorderOptionRows(threeOptions(), ["r0", "r1", "r2"], reorderEvent("r0", 0))).toBeNull();
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

    it("appends a blank row", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={threeOptions()} onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: /添加选项/ }));

      expect(onCommit).toHaveBeenLastCalledWith([...threeOptions(), { label: "", value: "" }]);
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
});
