import type { DragEndEvent } from "@vef-framework-react/core";
import type { ReactElement } from "react";

import type { FieldOption, RemoteDataSourceRequest } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { OptionListEditor, RemoteRequestFields, reorderOptionRows } from "./option-editors";

interface HarnessProps {
  initial: FieldOption[];
  onCommit?: (next: FieldOption[]) => void;
}

/**
 * Stateful round-trip harness mirroring the controlled usage in the
 * option-source entry and the data-source panel.
 */
function Harness({ initial, onCommit }: HarnessProps): ReactElement {
  const [options, setOptions] = useState(initial);

  return (
    <OptionListEditor
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
});

interface RemoteHarnessProps {
  initial: RemoteDataSourceRequest;
  onCommit?: (next: RemoteDataSourceRequest) => void;
}

/**
 * Stateful round-trip harness for the remote request editor, mirroring the
 * controlled usage in the option-source entry.
 */
function RemoteHarness({ initial, onCommit }: RemoteHarnessProps): ReactElement {
  const [request, setRequest] = useState(initial);

  return (
    <RemoteRequestFields
      mapping={undefined}
      request={request}
      onChange={next => {
        onCommit?.(next);
        setRequest(next);
      }}
    />
  );
}

describe("RemoteRequestFields params", () => {
  const twoParams: RemoteDataSourceRequest = {
    resource: "sys/ward",
    action: "find_options",
    params: {
      deptId: { kind: "literal", value: "1" },
      wardId: { kind: "expression", source: "$form.x" }
    }
  };

  it("does not drop the other row when a rename collides", async () => {
    // `Object.fromEntries` keeps the LAST entry for a duplicate key, so
    // committing the collision deleted the first row — its literal "1" and all
    // — the instant the keystroke completed the name.
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<RemoteHarness initial={twoParams} onCommit={onCommit} />);

    const [, second] = screen.getAllByPlaceholderText("参数名");
    await user.clear(second as HTMLElement);
    await user.type(second as HTMLElement, "deptId");

    // Nothing that collides reaches the schema, so both rows survive.
    for (const call of onCommit.mock.calls) {
      expect(Object.keys((call[0] as RemoteDataSourceRequest).params ?? {})).toHaveLength(2);
    }

    expect(screen.getAllByPlaceholderText("参数名")).toHaveLength(2);
  });

  it("warns about the collision instead of silently resolving it", async () => {
    const user = userEvent.setup();
    render(<RemoteHarness initial={twoParams} />);

    const [, second] = screen.getAllByPlaceholderText("参数名");
    await user.clear(second as HTMLElement);
    await user.type(second as HTMLElement, "deptId");

    expect(screen.getByText(/参数名重复，未保存/)).toBeInTheDocument();
  });

  it("commits a rename that does not collide", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<RemoteHarness initial={twoParams} onCommit={onCommit} />);

    const [, second] = screen.getAllByPlaceholderText("参数名");
    await user.clear(second as HTMLElement);
    await user.type(second as HTMLElement, "unitId");

    expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({
      params: {
        deptId: { kind: "literal", value: "1" },
        unitId: { kind: "expression", source: "$form.x" }
      }
    }));
  });
});
