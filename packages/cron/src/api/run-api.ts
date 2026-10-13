import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { PaginationResult, QueryFunction } from "@vef-framework-react/core";

import type { Run, RunIdParams, RunSearch } from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH, toCrudReadMeta } from "./query";

const RESOURCE = "sys/cron/run";

/**
 * The read-only query functions for the run journal resource.
 */
export interface RunApi {
  findPage: QueryFunction<PaginationResult<Run>, PaginatedQueryParams<RunSearch>>;
  findOne: QueryFunction<Run, RunIdParams>;
}

/**
 * Query API for the run journal. The detail view refetches the full row
 * through `find_one` so it always shows the complete, untruncated error text.
 */
export function useRunApi(): RunApi {
  const apiClient = useApiClient();

  return useMemo<RunApi>(
    () => {
      return {
        findPage: apiClient.createQueryFn<PaginationResult<Run>, PaginatedQueryParams<RunSearch>>(
          "cron_run_find_page",
          ({ post }) => async queryParams => {
            const result = await post<PaginationResult<Run>>(API_PATH, {
              data: createApiRequest(RESOURCE, "find_page", {}, toCrudReadMeta(queryParams))
            });

            return result.data;
          }
        ),
        findOne: apiClient.createQueryFn<Run, RunIdParams>(
          "cron_run_find_one",
          ({ post }) => async params => {
            // find_one names its row through the CRUD search in `meta`; sent as
            // `params`, the id would be dropped and an arbitrary run come back.
            const result = await post<Run>(API_PATH, { data: createApiRequest(RESOURCE, "find_one", {}, params) });

            return result.data;
          }
        )
      };
    },
    [apiClient]
  );
}
