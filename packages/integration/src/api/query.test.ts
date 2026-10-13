import type { PaginatedQueryParams } from "@vef-framework-react/components";

import { SYMBOL_PAGINATION } from "@vef-framework-react/components";

import { toCrudReadMeta } from "./query";

describe("toCrudReadMeta", () => {
  it("folds the filters and the pagination into one meta object", () => {
    const queryParams = {
      status: "active",
      [SYMBOL_PAGINATION]: { page: 2, size: 20 }
    } as PaginatedQueryParams<{ status: string }>;

    const meta = toCrudReadMeta(queryParams);

    expect(meta).toEqual({
      status: "active",
      page: 2,
      size: 20
    });
    expect(Object.getOwnPropertySymbols(meta)).toHaveLength(0);
  });

  it("keeps the filters when no pagination is set", () => {
    const queryParams = { status: "active" } as PaginatedQueryParams<{ status: string }>;

    expect(toCrudReadMeta(queryParams)).toEqual({ status: "active" });
  });
});
