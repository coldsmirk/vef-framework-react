import type { ApiClient, HttpClient, PaginationResult } from "@vef-framework-react/core";

import type { TableColumn } from "../table";
import type { OperationColumnConfig } from "./types";

import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestApiClient, render, screen, waitFor } from "../../test-utils";
import { ProTable } from "./index";

interface Row {
  id: string;
  name: string;
}

const TABLE_COLUMNS: Array<TableColumn<Row>> = [
  { dataIndex: "id", title: "ID" },
  { dataIndex: "name", title: "Name" }
];

const PAGE_OF_TWO: PaginationResult<Row> = {
  total: 2,
  items: [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" }
  ]
};

function pageHandler(): PaginationResult<Row> {
  return PAGE_OF_TWO;
}

function pageFactory(_http: Readonly<HttpClient>): typeof pageHandler {
  return pageHandler;
}

function listHandler(): Row[] {
  return PAGE_OF_TWO.items;
}

function listFactory(_http: Readonly<HttpClient>): typeof listHandler {
  return listHandler;
}

function emptyPageHandler(): PaginationResult<Row> {
  return { total: 0, items: [] };
}

function emptyPageFactory(_http: Readonly<HttpClient>): typeof emptyPageHandler {
  return emptyPageHandler;
}

describe("pro-table/ProTable", () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = createTestApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("paginated rendering", () => {
    it("renders the column headers in the order they are declared", () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>("rows/page", pageFactory);

      render(
        <ProTable<Row, Record<string, never>>
          columns={TABLE_COLUMNS}
          queryFn={queryFn as never}
          rowKey="id"
        />,
        { apiClient }
      );

      expect(screen.getByRole("columnheader", { name: "ID" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    });

    it("renders the rows returned by queryFn", async () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>("rows/page", pageFactory);

      render(
        <ProTable<Row, Record<string, never>>
          columns={TABLE_COLUMNS}
          queryFn={queryFn as never}
          rowKey="id"
        />,
        { apiClient }
      );

      await waitFor(() => {
        expect(screen.getByRole("cell", { name: "Alice" })).toBeInTheDocument();
      });
      expect(screen.getByRole("cell", { name: "Bob" })).toBeInTheDocument();
    });

    it("renders the sequence column by default", () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>("rows/page", pageFactory);

      render(
        <ProTable<Row, Record<string, never>>
          columns={TABLE_COLUMNS}
          queryFn={queryFn as never}
          rowKey="id"
        />,
        { apiClient }
      );

      expect(screen.getByRole("columnheader", { name: "序号" })).toBeInTheDocument();
    });

    it("hides the sequence column when showSequenceColumn is false", () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>("rows/page", pageFactory);

      render(
        <ProTable<Row, Record<string, never>>
          columns={TABLE_COLUMNS}
          queryFn={queryFn as never}
          rowKey="id"
          showSequenceColumn={false}
        />,
        { apiClient }
      );

      expect(screen.queryByRole("columnheader", { name: "序号" })).not.toBeInTheDocument();
    });
  });

  describe("non-paginated rendering", () => {
    it("renders the full list returned by queryFn without pagination", async () => {
      const queryFn = apiClient.createQueryFn<Row[]>("rows/all", listFactory);

      render(
        <ProTable<Row, Record<string, never>>
          columns={TABLE_COLUMNS}
          isPaginated={false}
          queryFn={queryFn as never}
          rowKey="id"
        />,
        { apiClient }
      );

      await waitFor(() => {
        expect(screen.getByRole("cell", { name: "Alice" })).toBeInTheDocument();
      });
      expect(screen.getByRole("cell", { name: "Bob" })).toBeInTheDocument();
    });
  });

  describe("header and footer slots", () => {
    it("renders the header content above the table", () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>("rows/page", emptyPageFactory);

      render(
        <ProTable<Row, Record<string, never>>
          columns={TABLE_COLUMNS}
          header={<div data-testid="table-header">Header Slot</div>}
          queryFn={queryFn as never}
          rowKey="id"
        />,
        { apiClient }
      );

      expect(screen.getByTestId("table-header")).toBeInTheDocument();
    });

    it("renders the footer content below the table", () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>("rows/page", emptyPageFactory);

      render(
        <ProTable<Row, Record<string, never>>
          columns={TABLE_COLUMNS}
          footer={<div data-testid="table-footer">Footer Slot</div>}
          queryFn={queryFn as never}
          rowKey="id"
        />,
        { apiClient }
      );

      expect(screen.getByTestId("table-footer")).toBeInTheDocument();
    });
  });

  describe("operation column", () => {
    it("renders the operation column with the provided title and per-row content", async () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>("rows/page", pageFactory);
      const operationColumn: OperationColumnConfig<Row> = {
        title: "操作",
        render(row) {
          return (
            <span data-testid={`op-${row.id}`}>
              edit
              {row.name}
            </span>
          );
        }
      };

      render(
        <ProTable<Row, Record<string, never>>
          columns={TABLE_COLUMNS}
          operationColumn={operationColumn}
          queryFn={queryFn as never}
          rowKey="id"
        />,
        { apiClient }
      );

      expect(screen.getByRole("columnheader", { name: /操作/ })).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId("op-1")).toBeInTheDocument();
      });
      expect(screen.getByTestId("op-2")).toBeInTheDocument();
    });
  });

  describe("row click", () => {
    it("fires onRowClick with the row data, index, and click event when a body row is clicked", async () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>("rows/page", pageFactory);
      const onRowClick = vi.fn();
      const user = userEvent.setup();

      render(
        <ProTable<Row, Record<string, never>>
          columns={TABLE_COLUMNS}
          queryFn={queryFn as never}
          rowKey="id"
          onRowClick={onRowClick}
        />,
        { apiClient }
      );

      await user.click(await screen.findByRole("cell", { name: "Alice" }));

      expect(onRowClick).toHaveBeenCalledTimes(1);
      const [row, index, event] = onRowClick.mock.calls[0]!;
      expect(row).toEqual({ id: "1", name: "Alice" });
      expect(index).toBe(0);
      expect(event.type).toBe("click");
    });

    it("shows a pointer cursor on body rows when onRowClick is provided", async () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>("rows/page", pageFactory);

      render(
        <ProTable<Row, Record<string, never>>
          columns={TABLE_COLUMNS}
          queryFn={queryFn as never}
          rowKey="id"
          onRowClick={vi.fn()}
        />,
        { apiClient }
      );

      const row = await screen.findByRole("row", { name: /Alice/ });
      expect(getComputedStyle(row).cursor).toBe("pointer");
    });

    it("ignores clicks that originate inside the operation column", async () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>("rows/page", pageFactory);
      const onRowClick = vi.fn();
      const user = userEvent.setup();
      const operationColumn: OperationColumnConfig<Row> = {
        render(row) {
          return <button type="button">{`edit ${row.name}`}</button>;
        }
      };

      render(
        <ProTable<Row, Record<string, never>>
          columns={TABLE_COLUMNS}
          operationColumn={operationColumn}
          queryFn={queryFn as never}
          rowKey="id"
          onRowClick={onRowClick}
        />,
        { apiClient }
      );

      await user.click(await screen.findByRole("button", { name: "edit Alice" }));

      expect(onRowClick).not.toHaveBeenCalled();
    });
  });

  describe("striped rows", () => {
    it("stripes every second row when striped is enabled", async () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>("rows/page", pageFactory);

      render(
        <ProTable<Row, Record<string, never>>
          striped
          columns={TABLE_COLUMNS}
          queryFn={queryFn as never}
          rowKey="id"
        />,
        { apiClient }
      );

      expect(await screen.findByRole("row", { name: /Bob/ })).toHaveClass("vef-table-row-striped");
      expect(screen.getByRole("row", { name: /Alice/ })).not.toHaveClass("vef-table-row-striped");
    });
  });

  describe("row selection", () => {
    it("fires onSelectedRowKeysChange with the chosen key when a row checkbox is clicked", async () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>, Record<string, never>>(
        "rows/page",
        pageFactory
      );
      const onSelectedRowKeysChange = vi.fn();
      const user = userEvent.setup();

      render(
        <ProTable<Row, Record<string, never>>
          rowSelection
          columns={TABLE_COLUMNS}
          queryFn={queryFn as never}
          rowKey="id"
          onSelectedRowKeysChange={onSelectedRowKeysChange}
        />,
        { apiClient }
      );

      await screen.findByRole("cell", { name: "Alice" });
      // Index 0 is the "select all" checkbox; the next two are the row checkboxes.
      const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
      await user.click(firstRowCheckbox!);

      expect(onSelectedRowKeysChange).toHaveBeenCalled();
      const [keys, rows] = onSelectedRowKeysChange.mock.calls.at(-1)!;
      expect(keys).toEqual(["1"]);
      expect(rows).toEqual([{ id: "1", name: "Alice" }]);
    });
  });
});
