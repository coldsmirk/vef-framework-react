import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { ApiResult, MutationFunction, PaginationResult, QueryFunction } from "@vef-framework-react/core";

import type { Delegation, DelegationParams, DelegationSearch } from "../types";

import { SYMBOL_PAGINATION } from "@vef-framework-react/components";
import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH } from "./query";

const RESOURCE = "approval/delegation";

/**
 * The CRUD API of approval delegations, shaped to plug straight into
 * `CrudPage`. The list is served by the framework's standard `find_page`,
 * which reads pagination from the request meta.
 */
export interface DelegationApi {
  findPage: QueryFunction<PaginationResult<Delegation>, PaginatedQueryParams<DelegationSearch>>;
  create: MutationFunction<ApiResult<unknown>, DelegationParams>;
  update: MutationFunction<ApiResult<unknown>, DelegationParams>;
  remove: MutationFunction<ApiResult<unknown>, Delegation>;
}

/**
 * CRUD API for approval delegations.
 */
export function useDelegationApi(): DelegationApi {
  const apiClient = useApiClient();

  return useMemo<DelegationApi>(
    () => {
      return {
        findPage: apiClient.createQueryFn<PaginationResult<Delegation>, PaginatedQueryParams<DelegationSearch>>(
          "approval_delegation_find_page",
          ({ post }) => async queryParams => {
            const { [SYMBOL_PAGINATION]: pagination, ...params } = queryParams;
            const result = await post<PaginationResult<Delegation>>(API_PATH, {
              data: createApiRequest(RESOURCE, "find_page", params, pagination)
            });

            return result.data;
          }
        ),
        create: apiClient.createMutationFn<ApiResult<unknown>, DelegationParams>(
          "approval_delegation_create",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "create", params) })
        ),
        update: apiClient.createMutationFn<ApiResult<unknown>, DelegationParams>(
          "approval_delegation_update",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "update", params) })
        ),
        remove: apiClient.createMutationFn<ApiResult<unknown>, Delegation>(
          "approval_delegation_delete",
          ({ post }) => row => post(API_PATH, { data: createApiRequest(RESOURCE, "delete", { id: row.id }) })
        )
      };
    },
    [apiClient]
  );
}
