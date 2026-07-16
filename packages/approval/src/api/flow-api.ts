import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { MutationFunction, PaginationResult, QueryFunction } from "@vef-framework-react/core";

import type {
  CreateFlowParams,
  DeployFlowParams,
  Flow,
  FlowGraphBundle,
  FlowInitiator,
  FlowSearch,
  FlowVersion,
  PublishVersionParams,
  ToggleFlowActiveParams,
  UpdateFlowParams
} from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH, toPagedParams } from "./query";

const RESOURCE = "approval/flow";

/**
 * The management API of flow definitions: the paginated list plus the
 * definition lifecycle (create → deploy → publish) and its auxiliary queries.
 * Mutations return the created/updated records so callers can chain the
 * lifecycle (e.g. create → deploy with the returned flow id).
 */
export interface FlowApi {
  findFlows: QueryFunction<PaginationResult<Flow>, PaginatedQueryParams<FlowSearch>>;
  create: MutationFunction<Flow, CreateFlowParams>;
  update: MutationFunction<Flow, UpdateFlowParams>;
  deploy: MutationFunction<FlowVersion, DeployFlowParams>;
  publishVersion: MutationFunction<unknown, PublishVersionParams>;
  toggleActive: MutationFunction<unknown, ToggleFlowActiveParams>;
  getGraph: QueryFunction<FlowGraphBundle, { flowId: string; tenantId?: string }>;
  findVersions: QueryFunction<FlowVersion[], { flowId: string; tenantId?: string }>;
  findInitiators: QueryFunction<FlowInitiator[], { flowId: string; tenantId?: string }>;
}

/**
 * Management API for flow definitions.
 */
export function useFlowApi(): FlowApi {
  const apiClient = useApiClient();

  return useMemo<FlowApi>(
    () => {
      return {
        findFlows: apiClient.createQueryFn<PaginationResult<Flow>, PaginatedQueryParams<FlowSearch>>(
          "approval_flow_find_flows",
          ({ post }) => async queryParams => {
            const result = await post<PaginationResult<Flow>>(API_PATH, {
              data: createApiRequest(RESOURCE, "find_flows", toPagedParams(queryParams))
            });

            return result.data;
          }
        ),
        create: apiClient.createMutationFn<Flow, CreateFlowParams>(
          "approval_flow_create",
          ({ post }) => async params => {
            const result = await post<Flow>(API_PATH, { data: createApiRequest(RESOURCE, "create", params) });

            return result.data;
          }
        ),
        update: apiClient.createMutationFn<Flow, UpdateFlowParams>(
          "approval_flow_update",
          ({ post }) => async params => {
            const result = await post<Flow>(API_PATH, { data: createApiRequest(RESOURCE, "update", params) });

            return result.data;
          }
        ),
        deploy: apiClient.createMutationFn<FlowVersion, DeployFlowParams>(
          "approval_flow_deploy",
          ({ post }) => async params => {
            const result = await post<FlowVersion>(API_PATH, { data: createApiRequest(RESOURCE, "deploy", params) });

            return result.data;
          }
        ),
        publishVersion: apiClient.createMutationFn<unknown, PublishVersionParams>(
          "approval_flow_publish_version",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "publish_version", params) })
        ),
        toggleActive: apiClient.createMutationFn<unknown, ToggleFlowActiveParams>(
          "approval_flow_toggle_active",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "toggle_active", params) })
        ),
        getGraph: apiClient.createQueryFn<FlowGraphBundle, { flowId: string; tenantId?: string }>(
          "approval_flow_get_graph",
          ({ post }) => async params => {
            const result = await post<FlowGraphBundle>(API_PATH, { data: createApiRequest(RESOURCE, "get_graph", params) });

            return result.data;
          }
        ),
        findVersions: apiClient.createQueryFn<FlowVersion[], { flowId: string; tenantId?: string }>(
          "approval_flow_find_versions",
          ({ post }) => async params => {
            const result = await post<FlowVersion[]>(API_PATH, { data: createApiRequest(RESOURCE, "find_versions", params) });

            return result.data;
          }
        ),
        findInitiators: apiClient.createQueryFn<FlowInitiator[], { flowId: string; tenantId?: string }>(
          "approval_flow_find_initiators",
          ({ post }) => async params => {
            const result = await post<FlowInitiator[]>(API_PATH, { data: createApiRequest(RESOURCE, "find_initiators", params) });

            return result.data;
          }
        )
      };
    },
    [apiClient]
  );
}
