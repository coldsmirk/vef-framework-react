import type { PaginationResult } from "@vef-framework-react/core";

import type { PaginatedQueryParams } from "./types";

import { describe, expect, it } from "vitest";

import { createTestApiClient, render, screen } from "../../test-utils";
import { Crud } from "./index";

function firstPage() {
  return { items: [{ id: "first" }], total: 1 };
}

describe("Crud layout", () => {
  it("keeps a scrollable card around the toolbar and a usable table body", async () => {
    const apiClient = createTestApiClient();
    const queryFn = apiClient.createQueryFn<PaginationResult<{ id: string }>, PaginatedQueryParams<Record<string, never>>>(
      "rows/list",
      () => firstPage
    );
    render(
      <Crud
        basicSearch={<input aria-label="Filter" />}
        queryFn={queryFn}
        rowKey="id"
        tableColumns={[{ dataIndex: "id", title: "ID" }]}
      />,
      { apiClient }
    );

    const row = await screen.findByText("first");
    const card = row.closest(".vef-card");
    expect(card).toContainElement(screen.getByRole("textbox", { name: "Filter" }));
    expect(card).toHaveStyle({ overflowY: "auto" });
    expect(row.closest(".vef-card-body")).toHaveStyle({ minHeight: "14rem" });
  });
});
