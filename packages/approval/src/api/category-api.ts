import type { QueryParams } from "@vef-framework-react/components";
import type { ApiResult, MutationFunction, QueryFunction } from "@vef-framework-react/core";

import type { CategoryParams, CategorySearch, FlowCategory } from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH } from "./query";

const RESOURCE = "approval/category";

/**
 * The query and mutation functions for the flow-category tree, shaped to plug
 * straight into a non-paginated `CrudPage`.
 */
export interface CategoryApi {
  findTree: QueryFunction<FlowCategory[], QueryParams<CategorySearch>>;
  create: MutationFunction<ApiResult<unknown>, CategoryParams>;
  update: MutationFunction<ApiResult<unknown>, CategoryParams>;
  remove: MutationFunction<ApiResult<unknown>, FlowCategory>;
}

/**
 * CRUD API for the flow-category tree.
 */
export function useCategoryApi(): CategoryApi {
  const apiClient = useApiClient();

  return useMemo<CategoryApi>(
    () => {
      return {
        findTree: apiClient.createQueryFn<FlowCategory[], QueryParams<CategorySearch>>(
          "approval_category_find_tree",
          ({ post }) => async params => {
            const result = await post<FlowCategory[]>(API_PATH, { data: createApiRequest(RESOURCE, "find_tree", params) });

            return result.data;
          }
        ),
        create: apiClient.createMutationFn<ApiResult<unknown>, CategoryParams>(
          "approval_category_create",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "create", params) })
        ),
        update: apiClient.createMutationFn<ApiResult<unknown>, CategoryParams>(
          "approval_category_update",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "update", params) })
        ),
        remove: apiClient.createMutationFn<ApiResult<unknown>, FlowCategory>(
          "approval_category_delete",
          ({ post }) => row => post(API_PATH, { data: createApiRequest(RESOURCE, "delete", { id: row.id }) })
        )
      };
    },
    [apiClient]
  );
}
