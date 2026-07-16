import type { QueryFunction } from "@vef-framework-react/core";

import type { IntegrationStatsResult } from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH } from "./query";

/**
 * The query function for per-node integration invocation statistics.
 */
export interface StatsApi {
  getStats: QueryFunction<IntegrationStatsResult>;
}

/**
 * Statistics API, served by the monitor resource.
 */
export function useStatsApi(): StatsApi {
  const apiClient = useApiClient();

  return useMemo<StatsApi>(
    () => {
      return {
        getStats: apiClient.createQueryFn<IntegrationStatsResult>(
          "integration_get_stats",
          ({ post }) => async () => {
            const result = await post<IntegrationStatsResult>(API_PATH, {
              data: createApiRequest("sys/monitor", "get_integration_stats")
            });

            return result.data;
          }
        )
      };
    },
    [apiClient]
  );
}
