import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { MutationFunction, PaginationResult, QueryFunction } from "@vef-framework-react/core";

import type {
  AdminActionLog,
  AdminBusinessProjection,
  AdminBusinessProjectionSearch,
  AdminInstance,
  AdminInstanceDetail,
  AdminInstanceSearch,
  AdminTask,
  AdminTaskSearch,
  ApplyHandoversParams,
  ApprovalMetrics,
  HandoverReport,
  PlanVoidParams,
  PlanVoidResult,
  ReassignTaskParams,
  RetryBusinessProjectionParams,
  TerminateInstanceParams,
  VoidInstanceParams
} from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH, toPagedParams } from "./query";

const RESOURCE = "approval/admin";

/**
 * The supervision API of the approval engine: cross-user instance/task
 * queries, the audit trail, engine metrics, business-projection convergence,
 * and the admin write actions.
 */
export interface AdminApprovalApi {
  findInstances: QueryFunction<PaginationResult<AdminInstance>, PaginatedQueryParams<AdminInstanceSearch>>;
  findTasks: QueryFunction<PaginationResult<AdminTask>, PaginatedQueryParams<AdminTaskSearch>>;
  getInstanceDetail: QueryFunction<AdminInstanceDetail, { instanceId: string }>;
  findActionLogs: QueryFunction<PaginationResult<AdminActionLog>, PaginatedQueryParams<{ instanceId: string; tenantId?: string }>>;
  getMetrics: QueryFunction<ApprovalMetrics, { tenantId?: string }>;
  findBusinessProjections: QueryFunction<PaginationResult<AdminBusinessProjection>, PaginatedQueryParams<AdminBusinessProjectionSearch>>;
  terminateInstance: MutationFunction<unknown, TerminateInstanceParams>;
  reassignTask: MutationFunction<unknown, ReassignTaskParams>;
  retryBusinessProjection: MutationFunction<unknown, RetryBusinessProjectionParams>;
  planVoid: QueryFunction<PlanVoidResult, PlanVoidParams>;
  voidInstance: MutationFunction<unknown, VoidInstanceParams>;
  applyHandovers: MutationFunction<HandoverReport, ApplyHandoversParams>;
}

/**
 * Supervision API for approval administrators.
 */
export function useAdminApprovalApi({ inlineReassignErrors = false } = {}): AdminApprovalApi {
  const apiClient = useApiClient();

  return useMemo<AdminApprovalApi>(
    () => {
      function pagedQuery<TRow, TSearch extends object>(
        name: string
      ): QueryFunction<PaginationResult<TRow>, PaginatedQueryParams<TSearch>> {
        return apiClient.createQueryFn<PaginationResult<TRow>, PaginatedQueryParams<TSearch>>(
          `approval_admin_${name}`,
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
          `approval_admin_${name}`,
          ({ post }) => async params => {
            const result = await post<TData>(API_PATH, { data: createApiRequest(RESOURCE, name, params) });

            return result.data;
          }
        );
      }

      function action<TParams extends object>(name: string, skipErrorMessage = false): MutationFunction<unknown, TParams> {
        return apiClient.createMutationFn<unknown, TParams>(
          `approval_admin_${name}`,
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, name, params), ...skipErrorMessage && { skipErrorMessage } })
        );
      }

      return {
        findInstances: pagedQuery<AdminInstance, AdminInstanceSearch>("find_instances"),
        findTasks: pagedQuery<AdminTask, AdminTaskSearch>("find_tasks"),
        getInstanceDetail: detailQuery<AdminInstanceDetail, { instanceId: string }>("get_instance_detail"),
        findActionLogs: pagedQuery<AdminActionLog, { instanceId: string; tenantId?: string }>("find_action_logs"),
        getMetrics: detailQuery<ApprovalMetrics, { tenantId?: string }>("get_metrics"),
        findBusinessProjections: pagedQuery<AdminBusinessProjection, AdminBusinessProjectionSearch>("find_business_projections"),
        planVoid: detailQuery<PlanVoidResult, PlanVoidParams>("plan_void"),
        voidInstance: action<VoidInstanceParams>("void_instance"),
        terminateInstance: action<TerminateInstanceParams>("terminate_instance"),
        reassignTask: action<ReassignTaskParams>("reassign_task", inlineReassignErrors),
        retryBusinessProjection: action<RetryBusinessProjectionParams>("retry_business_projection"),
        applyHandovers: apiClient.createMutationFn<HandoverReport, ApplyHandoversParams>(
          "approval_admin_apply_handovers",
          ({ post }) => async params => {
            const result = await post<HandoverReport>(API_PATH, { data: createApiRequest(RESOURCE, "apply_handovers", params) });

            return result.data;
          }
        )
      };
    },
    [apiClient, inlineReassignErrors]
  );
}
