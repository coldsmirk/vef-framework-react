import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { PaginationResult, QueryFunction } from "@vef-framework-react/core";

import type {
  AvailableFlow,
  AvailableFlowSearch,
  CompletedTask,
  InitiatedInstance,
  InitiatedInstanceSearch,
  MyCCRecord,
  MyCCRecordSearch,
  MyInstanceDetail,
  MyTaskSearch,
  PendingCounts,
  PendingTask,
  StartForm
} from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH, toPagedParams } from "./query";

const RESOURCE = "approval/my";

/**
 * The self-service queries of the current user: what I can initiate, what I
 * submitted, what awaits me, and the per-instance detail. All operations are
 * user-scoped server-side and carry no permission codes.
 */
export interface MyApprovalApi {
  findAvailableFlows: QueryFunction<PaginationResult<AvailableFlow>, PaginatedQueryParams<AvailableFlowSearch>>;
  getStartForm: QueryFunction<StartForm, { tenantId: string; flowCode: string }>;
  findInitiated: QueryFunction<PaginationResult<InitiatedInstance>, PaginatedQueryParams<InitiatedInstanceSearch>>;
  findPendingTasks: QueryFunction<PaginationResult<PendingTask>, PaginatedQueryParams<MyTaskSearch>>;
  findCompletedTasks: QueryFunction<PaginationResult<CompletedTask>, PaginatedQueryParams<MyTaskSearch>>;
  findCCRecords: QueryFunction<PaginationResult<MyCCRecord>, PaginatedQueryParams<MyCCRecordSearch>>;
  getPendingCounts: QueryFunction<PendingCounts, { tenantId?: string }>;
  getInstanceDetail: QueryFunction<MyInstanceDetail, { instanceId: string }>;
}

/**
 * Self-service API for the current user's approval work.
 */
export function useMyApprovalApi(): MyApprovalApi {
  const apiClient = useApiClient();

  return useMemo<MyApprovalApi>(
    () => {
      function pagedQuery<TRow, TSearch extends object>(
        name: string
      ): QueryFunction<PaginationResult<TRow>, PaginatedQueryParams<TSearch>> {
        return apiClient.createQueryFn<PaginationResult<TRow>, PaginatedQueryParams<TSearch>>(
          `approval_my_${name}`,
          ({ post }) => async queryParams => {
            const result = await post<PaginationResult<TRow>>(API_PATH, {
              data: createApiRequest(RESOURCE, name, toPagedParams(queryParams))
            });

            return result.data;
          }
        );
      }

      function detailQuery<TData, TParams extends object>(name: string): QueryFunction<TData, TParams> {
        return apiClient.createQueryFn<TData, TParams>(
          `approval_my_${name}`,
          ({ post }) => async params => {
            const result = await post<TData>(API_PATH, { data: createApiRequest(RESOURCE, name, params) });

            return result.data;
          }
        );
      }

      return {
        findAvailableFlows: pagedQuery<AvailableFlow, AvailableFlowSearch>("find_available_flows"),
        getStartForm: detailQuery<StartForm, { tenantId: string; flowCode: string }>("get_start_form"),
        findInitiated: pagedQuery<InitiatedInstance, InitiatedInstanceSearch>("find_initiated"),
        findPendingTasks: pagedQuery<PendingTask, MyTaskSearch>("find_pending_tasks"),
        findCompletedTasks: pagedQuery<CompletedTask, MyTaskSearch>("find_completed_tasks"),
        findCCRecords: pagedQuery<MyCCRecord, MyCCRecordSearch>("find_cc_records"),
        getPendingCounts: detailQuery<PendingCounts, { tenantId?: string }>("get_pending_counts"),
        getInstanceDetail: detailQuery<MyInstanceDetail, { instanceId: string }>("get_instance_detail")
      };
    },
    [apiClient]
  );
}
