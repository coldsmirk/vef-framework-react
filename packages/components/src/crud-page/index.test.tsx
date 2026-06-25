import type { ApiClient, HttpClient, PaginationResult } from "@vef-framework-react/core";

import type { TableColumn } from "../table";

import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestApiClient, render, screen } from "../../test-utils";
import { CrudPage } from "./index";

interface Row {
  id: string;
  name: string;
}

const EMPTY_PAGE: PaginationResult<Row> = {
  total: 0,
  items: []
};

function emptyListHandler(): PaginationResult<Row> {
  return EMPTY_PAGE;
}

function emptyListFactory(_http: Readonly<HttpClient>): typeof emptyListHandler {
  return emptyListHandler;
}

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

const TABLE_COLUMNS: Array<TableColumn<Row>> = [
  { dataIndex: "id", title: "ID" },
  { dataIndex: "name", title: "Name" }
];

describe("crud-page/CrudPage", () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = createTestApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("page slot wiring", () => {
    it("renders the header slot when header is provided", () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>(
        "rows/list",
        emptyListFactory
      );

      render(
        <CrudPage<Row, Record<string, never>, Record<string, never>>
          header={<div data-testid="page-header">Page Header</div>}
          queryFn={queryFn as never}
          rowKey="id"
          tableColumns={TABLE_COLUMNS}
        />,
        { apiClient }
      );

      expect(screen.getByTestId("page-header")).toBeInTheDocument();
    });

    it("renders the footer slot when footer is provided", () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>(
        "rows/list",
        emptyListFactory
      );

      render(
        <CrudPage<Row, Record<string, never>, Record<string, never>>
          footer={<div data-testid="page-footer">Page Footer</div>}
          queryFn={queryFn as never}
          rowKey="id"
          tableColumns={TABLE_COLUMNS}
        />,
        { apiClient }
      );

      expect(screen.getByTestId("page-footer")).toBeInTheDocument();
    });

    it("renders the leftAside slot when leftAside is provided", () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>(
        "rows/list",
        emptyListFactory
      );

      render(
        <CrudPage<Row, Record<string, never>, Record<string, never>>
          leftAside={<aside data-testid="left-aside">Left</aside>}
          queryFn={queryFn as never}
          rowKey="id"
          tableColumns={TABLE_COLUMNS}
        />,
        { apiClient }
      );

      expect(screen.getByTestId("left-aside")).toBeInTheDocument();
    });

    it("renders the rightAside slot when rightAside is provided", () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>(
        "rows/list",
        emptyListFactory
      );

      render(
        <CrudPage<Row, Record<string, never>, Record<string, never>>
          queryFn={queryFn as never}
          rightAside={<aside data-testid="right-aside">Right</aside>}
          rowKey="id"
          tableColumns={TABLE_COLUMNS}
        />,
        { apiClient }
      );

      expect(screen.getByTestId("right-aside")).toBeInTheDocument();
    });
  });

  describe("forwarding to Crud", () => {
    it("renders the inner Crud table region when crud props are forwarded", () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>(
        "rows/list",
        emptyListFactory
      );

      render(
        <CrudPage<Row, Record<string, never>, Record<string, never>>
          queryFn={queryFn as never}
          rowKey="id"
          tableColumns={TABLE_COLUMNS}
        />,
        { apiClient }
      );

      expect(screen.getByRole("columnheader", { name: "ID" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    });

    it("forwards onRowClick down to the table rows", async () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>(
        "rows/list",
        pageFactory
      );
      const onRowClick = vi.fn();
      const user = userEvent.setup();

      render(
        <CrudPage<Row, Record<string, never>, Record<string, never>>
          queryFn={queryFn as never}
          rowKey="id"
          tableColumns={TABLE_COLUMNS}
          onRowClick={onRowClick}
        />,
        { apiClient }
      );

      await user.click(await screen.findByRole("cell", { name: "Alice" }));

      expect(onRowClick).toHaveBeenCalledTimes(1);
      expect(onRowClick.mock.calls[0]![0]).toEqual({ id: "1", name: "Alice" });
    });

    it("forwards striped down to the table rows", async () => {
      const queryFn = apiClient.createQueryFn<PaginationResult<Row>>(
        "rows/list",
        pageFactory
      );

      render(
        <CrudPage<Row, Record<string, never>, Record<string, never>>
          striped
          queryFn={queryFn as never}
          rowKey="id"
          tableColumns={TABLE_COLUMNS}
        />,
        { apiClient }
      );

      expect(await screen.findByRole("row", { name: /Bob/ })).toHaveClass("vef-table-row-striped");
    });
  });
});
