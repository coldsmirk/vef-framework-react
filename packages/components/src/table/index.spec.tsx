import type { TableColumn } from "./index";

import { render, screen } from "../../test-utils";
import { Table } from "./index";

interface Row {
  id: string;
  name: string;
}

const TABLE_COLUMNS: Array<TableColumn<Row>> = [{ dataIndex: "name", title: "Name" }];

const DATA_SOURCE: Row[] = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
  { id: "3", name: "Carol" }
];

describe("table/Table", () => {
  describe("striped", () => {
    it("does not mark any row as striped by default", () => {
      render(
        <Table<Row>
          columns={TABLE_COLUMNS}
          dataSource={DATA_SOURCE}
          rowKey="id"
        />
      );

      expect(screen.getByRole("row", { name: /Bob/ })).not.toHaveClass("vef-table-row-striped");
    });

    it("marks every second body row as striped when striped is enabled", () => {
      render(
        <Table<Row>
          striped
          columns={TABLE_COLUMNS}
          dataSource={DATA_SOURCE}
          rowKey="id"
        />
      );

      expect(screen.getByRole("row", { name: /Alice/ })).not.toHaveClass("vef-table-row-striped");
      expect(screen.getByRole("row", { name: /Bob/ })).toHaveClass("vef-table-row-striped");
      expect(screen.getByRole("row", { name: /Carol/ })).not.toHaveClass("vef-table-row-striped");
    });

    it("applies the stripe tint to cells of striped rows", () => {
      render(
        <Table<Row>
          striped
          columns={TABLE_COLUMNS}
          dataSource={DATA_SOURCE}
          rowKey="id"
        />
      );

      const stripedCell = screen.getByRole("cell", { name: "Bob" });
      const plainCell = screen.getByRole("cell", { name: "Alice" });

      expect(getComputedStyle(stripedCell).backgroundImage).toContain("linear-gradient");
      expect(getComputedStyle(plainCell).backgroundImage).not.toContain("linear-gradient");
    });

    it("preserves a caller-provided rowClassName on striped rows", () => {
      render(
        <Table<Row>
          striped
          columns={TABLE_COLUMNS}
          dataSource={DATA_SOURCE}
          rowClassName={row => `custom-${row.id}`}
          rowKey="id"
        />
      );

      const stripedRow = screen.getByRole("row", { name: /Bob/ });
      expect(stripedRow).toHaveClass("custom-2");
      expect(stripedRow).toHaveClass("vef-table-row-striped");
    });
  });
});
