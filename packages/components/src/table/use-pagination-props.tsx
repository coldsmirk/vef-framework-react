import type { PaginationParams } from "@vef-framework-react/core";

import type { TablePaginationConfig } from ".";

import { useMemo } from "react";

import { useComponentDefaults } from "../config-provider/component-defaults";

interface UsePaginationPropsOptions {
  paginationParams: PaginationParams;
  total: number;
}

export const pageSizeOptions = [10, 15, 20, 30, 40, 50, 100];

const DEFAULT_PAGE = 1;
const [, DEFAULT_PAGE_SIZE] = pageSizeOptions;

function renderTotal(total: number, range: [number, number]) {
  return (
    <>
      第
      {" "}

      <strong>
        {range[0]}
        {" "}
        -
        {" "}
        {range[1]}
      </strong>

      {" "}
      条 / 共
      {" "}
      <strong>{total}</strong>
      {" "}
      条
    </>
  );
}

export function usePaginationProps({
  total,
  paginationParams
}: UsePaginationPropsOptions): TablePaginationConfig {
  // Framework tables always offer the page-size changer unless the application
  // defaults it otherwise. The value is passed explicitly, which would shadow the
  // antd-level default, so the application's entry is resolved here as well.
  const showSizeChanger = useComponentDefaults("Pagination")?.showSizeChanger ?? true;

  return useMemo(() => {
    return {
      size: "medium",
      showSizeChanger,
      showTotal: renderTotal,
      pageSizeOptions,
      current: paginationParams.page ?? DEFAULT_PAGE,
      pageSize: paginationParams.size ?? DEFAULT_PAGE_SIZE,
      total,
      placement: ["bottomEnd"]
    };
  }, [paginationParams.page, paginationParams.size, showSizeChanger, total]);
}
