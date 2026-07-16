import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { PaginationResult, QueryFunction } from "@vef-framework-react/core";

import type { InvocationLog, LogSearch } from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH, splitQueryParams } from "./query";

/**
 * The read-only query functions for the invocation log resource.
 */
export interface LogApi {
  findPage: QueryFunction<PaginationResult<InvocationLog>, PaginatedQueryParams<LogSearch>>;
}

// Query API for the invocation log. Rows carry the full captures, so the
// detail view reads from the row rather than a separate fetch.
export function useLogApi(): LogApi {
  const apiClient = useApiClient();

  return useMemo<LogApi>(
    () => {
      return {
        findPage: apiClient.createQueryFn<PaginationResult<InvocationLog>, PaginatedQueryParams<LogSearch>>(
          "integration_log_find_page",
          ({ post }) => async queryParams => {
            const { params, pagination } = splitQueryParams(queryParams);
            const result = await post<PaginationResult<InvocationLog>>(API_PATH, {
              data: createApiRequest("integration/log", "find_page", params, pagination)
            });

            return result.data;
          }
        )
      };
    },
    [apiClient]
  );
}
