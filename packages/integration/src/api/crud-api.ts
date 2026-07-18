import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { ApiClient, ApiResult, MutationFunction, PaginationResult, QueryFunction } from "@vef-framework-react/core";
import type { AnyObject } from "@vef-framework-react/shared";

import type {
  Adapter,
  AdapterParams,
  AdapterSearch,
  CodeMap,
  CodeMapParams,
  CodeMapSearch,
  Contract,
  ContractParams,
  ContractSearch,
  Route,
  RouteParams,
  RouteSearch,
  System,
  SystemParams,
  SystemSearch
} from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH, splitQueryParams } from "./query";

interface Identifiable {
  id: string;
}

/**
 * The query and mutation functions for one CRUD resource, shaped to plug
 * straight into `CrudPage`: `findPage` is its `queryFn`, `create`/`update`
 * its `formMutationFns`, and `remove`/`removeMany` its delete mutation fns
 * (both receive the row objects, mirroring the framework's CRUD contract).
 */
export interface CrudApi<TRow extends Identifiable, TParams, TSearch extends AnyObject> {
  findPage: QueryFunction<PaginationResult<TRow>, PaginatedQueryParams<TSearch>>;
  create: MutationFunction<ApiResult<unknown>, TParams>;
  update: MutationFunction<ApiResult<unknown>, TParams>;
  remove: MutationFunction<ApiResult<unknown>, TRow>;
  removeMany: MutationFunction<ApiResult<unknown>, TRow[]>;
}

/**
 * Build the CRUD query/mutation functions for a resource against the app's
 * API client. `keyPrefix` namespaces the TanStack Query cache keys.
 */
export function createCrudApi<TRow extends Identifiable, TParams extends object, TSearch extends AnyObject>(
  apiClient: ApiClient,
  resource: string,
  keyPrefix: string
): CrudApi<TRow, TParams, TSearch> {
  return {
    findPage: apiClient.createQueryFn<PaginationResult<TRow>, PaginatedQueryParams<TSearch>>(
      `${keyPrefix}_find_page`,
      ({ post }) => async queryParams => {
        const { params, pagination } = splitQueryParams(queryParams);
        const result = await post<PaginationResult<TRow>>(API_PATH, {
          data: createApiRequest(resource, "find_page", params, pagination)
        });

        return result.data;
      }
    ),
    create: apiClient.createMutationFn<ApiResult<unknown>, TParams>(
      `${keyPrefix}_create`,
      ({ post }) => params => post(API_PATH, { data: createApiRequest(resource, "create", params) })
    ),
    update: apiClient.createMutationFn<ApiResult<unknown>, TParams>(
      `${keyPrefix}_update`,
      ({ post }) => params => post(API_PATH, { data: createApiRequest(resource, "update", params) })
    ),
    remove: apiClient.createMutationFn<ApiResult<unknown>, TRow>(
      `${keyPrefix}_delete`,
      ({ post }) => row => post(API_PATH, { data: createApiRequest(resource, "delete", { id: row.id }) })
    ),
    removeMany: apiClient.createMutationFn<ApiResult<unknown>, TRow[]>(
      `${keyPrefix}_delete_many`,
      ({ post }) => rows => post(API_PATH, { data: createApiRequest(resource, "delete_many", { pks: rows.map(row => row.id) }) })
    )
  };
}

/**
 * CRUD API for the contract resource.
 */
export function useContractApi(): CrudApi<Contract, ContractParams, ContractSearch> {
  const apiClient = useApiClient();

  return useMemo(
    () => createCrudApi<Contract, ContractParams, ContractSearch>(apiClient, "integration/contract", "integration_contract"),
    [apiClient]
  );
}

/**
 * CRUD API for the system resource.
 */
export function useSystemApi(): CrudApi<System, SystemParams, SystemSearch> {
  const apiClient = useApiClient();

  return useMemo(
    () => createCrudApi<System, SystemParams, SystemSearch>(apiClient, "integration/system", "integration_system"),
    [apiClient]
  );
}

/**
 * CRUD API for the adapter resource.
 */
export function useAdapterApi(): CrudApi<Adapter, AdapterParams, AdapterSearch> {
  const apiClient = useApiClient();

  return useMemo(
    () => createCrudApi<Adapter, AdapterParams, AdapterSearch>(apiClient, "integration/adapter", "integration_adapter"),
    [apiClient]
  );
}

/**
 * CRUD API for the route resource.
 */
export function useRouteApi(): CrudApi<Route, RouteParams, RouteSearch> {
  const apiClient = useApiClient();

  return useMemo(
    () => createCrudApi<Route, RouteParams, RouteSearch>(apiClient, "integration/route", "integration_route"),
    [apiClient]
  );
}

/**
 * CRUD API for the code map resource.
 */
export function useCodeMapApi(): CrudApi<CodeMap, CodeMapParams, CodeMapSearch> {
  const apiClient = useApiClient();

  return useMemo(
    () => createCrudApi<CodeMap, CodeMapParams, CodeMapSearch>(apiClient, "integration/code_map", "integration_code_map"),
    [apiClient]
  );
}
