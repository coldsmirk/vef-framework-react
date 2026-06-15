import type { PaginationParams } from "@vef-framework-react/core";

import type { TablePaginationConfig } from ".";

import { useMemo } from "react";

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
  return useMemo(() => {
    return {
      size: "medium",
      showSizeChanger: true,
      showTotal: renderTotal,
      pageSizeOptions,
      current: paginationParams.page ?? DEFAULT_PAGE,
      pageSize: paginationParams.size ?? DEFAULT_PAGE_SIZE,
      total,
      placement: ["bottomEnd"]
    };
  }, [paginationParams.page, paginationParams.size, total]);
}
