import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { MutationFunction, PaginationResult, QueryFunction } from "@vef-framework-react/core";

import type { InvocationLog, LogSearch, ReplayParams, ReplayResult } from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH, splitQueryParams } from "./query";

/**
 * The invocation log resource: the page query plus replay, a mutation because
 * it is triggered imperatively and an outbound replay's calls are real.
 */
export interface LogApi {
  findPage: QueryFunction<PaginationResult<InvocationLog>, PaginatedQueryParams<LogSearch>>;
  replay: MutationFunction<ReplayResult, ReplayParams>;
}

// API for the invocation log. Rows carry the full captures, so the detail
// view reads from the row rather than a separate fetch.
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
        ),
        replay: apiClient.createMutationFn<ReplayResult, ReplayParams>(
          "integration_log_replay",
          ({ post }) => async params => {
            const result = await post<ReplayResult>(API_PATH, {
              data: createApiRequest("integration/log", "replay", params),
              bodyEncoding: "gzip+base64"
            });

            return result.data;
          }
        )
      };
    },
    [apiClient]
  );
}
