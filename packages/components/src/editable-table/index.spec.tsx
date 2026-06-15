import type { EditableColumn } from ".";

import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { createEditableColumn, EditableTable } from ".";
import { render, screen, waitFor, within } from "../../test-utils";
import { showErrorMessage } from "../_base/helpers/message";

vi.mock("../_base/helpers/message", async importOriginal => {
  const actual = await importOriginal<typeof import("../_base/helpers/message")>();
  return { ...actual, showErrorMessage: vi.fn() };
});

interface Row {
  id: string;
  name: string;
  age: number;
}

const initialRows: Row[] = [
  {
    id: "1",
    name: "Edward",
    age: 32
  },
  {
    id: "2",
    name: "Helena",
    age: 28
  }
];

const columns: Array<EditableColumn<Row>> = [
  createEditableColumn<Row>("name", {
    title: "Name",
    validators: { onChange: ({ value }) => value ? undefined : "Name required" },
    renderEditor: field => <field.Input noWrapper />
  }),
  createEditableColumn<Row>("age", {
    title: "Age",
    renderView: value => (
      <span>
        {String(value)}
        {" "}
        yo
      </span>
    ),
    renderEditor: field => <field.InputNumber noWrapper />
  })
];

// antd inserts a space between two CJK characters in a button, so "编辑" renders
// as "编 辑". Match the accessible name tolerant of that optional spacing.
function label(text: string): RegExp {
  return new RegExp(`^${[...text].join(String.raw`\s*`)}$`);
}

function Harness({
  onChange,
  ...overrides
}: { onChange?: (value: Row[]) => void } & Partial<Omit<Parameters<typeof EditableTable<Row>>[0], "value" | "onChange">>) {
  const [rows, setRows] = useState<Row[]>(initialRows);

  return (
    <EditableTable<Row>
      columns={columns}
      rowKey="id"
      {...overrides}
      value={rows}
      onChange={next => {
        onChange?.(next);
        setRows(next);
      }}
    />
  );
}

function rowOf(text: string): HTMLElement {
  return screen.getByText(text).closest("tr")!;
}

describe("EditableTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("read mode", () => {
    it("renders the raw value for a column without renderView", () => {
      render(<Harness />);

      expect(screen.getByText("Edward")).toBeInTheDocument();
      expect(screen.getByText("Helena")).toBeInTheDocument();
    });

    it("renders renderView output for a column that defines it", () => {
      render(<Harness />);

      expect(screen.getByText("32 yo")).toBeInTheDocument();
      expect(screen.getByText("28 yo")).toBeInTheDocument();
    });
  });

  describe("entering edit", () => {
    it("turns only the clicked row into inputs", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const row1 = rowOf("Edward");
      await user.click(within(row1).getByRole("button", { name: label("编辑") }));

      expect(within(row1).getByRole("textbox")).toHaveValue("Edward");
      expect(within(rowOf("Helena")).queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("disables Edit on the other rows while one row is editing", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(within(rowOf("Edward")).getByRole("button", { name: label("编辑") }));

      expect(within(rowOf("Helena")).getByRole("button", { name: label("编辑") })).toBeDisabled();
    });
  });

  describe("saving", () => {
    it("merges the edited values into onChange and returns to read mode", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      const row1 = rowOf("Edward");
      await user.click(within(row1).getByRole("button", { name: label("编辑") }));

      const input = within(row1).getByRole("textbox");
      await user.clear(input);
      await user.type(input, "Edmund");
      await user.click(within(row1).getByRole("button", { name: label("保存") }));

      expect(onChange.mock.lastCall?.[0]).toEqual([
        {
          id: "1",
          name: "Edmund",
          age: 32
        },
        {
          id: "2",
          name: "Helena",
          age: 28
        }
      ]);
      expect(await screen.findByText("Edmund")).toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("blocks save, keeps edit mode, and surfaces the error via message", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      const row1 = rowOf("Edward");
      await user.click(within(row1).getByRole("button", { name: label("编辑") }));
      await user.clear(within(row1).getByRole("textbox"));
      await user.click(within(row1).getByRole("button", { name: label("保存") }));

      expect(showErrorMessage).toHaveBeenCalled();
      expect(within(row1).getByRole("textbox")).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("cancelling", () => {
    it("discards the draft and does not call onChange", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      const row1 = rowOf("Edward");
      await user.click(within(row1).getByRole("button", { name: label("编辑") }));
      await user.clear(within(row1).getByRole("textbox"));
      await user.type(within(row1).getByRole("textbox"), "Discarded");
      await user.click(within(row1).getByRole("button", { name: label("取消") }));

      expect(onChange).not.toHaveBeenCalled();
      expect(await screen.findByText("Edward")).toBeInTheDocument();
    });
  });

  describe("adding", () => {
    it("appends a row via onChange and enters edit mode for it", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness creatable onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: label("新增记录") }));

      expect(onChange.mock.lastCall?.[0]).toHaveLength(3);
      expect(screen.getByRole("button", { name: label("保存") })).toBeInTheDocument();
    });
  });

  describe("deleting", () => {
    it("removes a row via onChange", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness canDelete onChange={onChange} />);

      await user.click(within(rowOf("Edward")).getByRole("button", { name: label("删除") }));

      expect(onChange.mock.lastCall?.[0]).toEqual([
        {
          id: "2",
          name: "Helena",
          age: 28
        }
      ]);
      await waitFor(() => expect(screen.queryByText("Edward")).not.toBeInTheDocument());
    });
  });

  describe("rowKey", () => {
    it("supports a functional rowKey", async () => {
      const user = userEvent.setup();
      render(<Harness rowKey={row => row.id} />);

      const row1 = rowOf("Edward");
      await user.click(within(row1).getByRole("button", { name: label("编辑") }));

      expect(within(row1).getByRole("textbox")).toHaveValue("Edward");
    });
  });
});
