import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { PaginationResult } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface ConfigDefinition extends FullAuditedEntity {
  category?: MaybeNull<string>;
  categoryName?: string;
  key: string;
  name: string;
  description?: MaybeNull<string>;
  valueType: string;
  valueTypeName?: string;
  isRequired: boolean;
  remark?: MaybeNull<string>;
  sortOrder: number;
  meta?: MaybeNull<Record<string, any>>;
}

export interface ConfigDefinitionSearch {
  keyword?: string;
}

export type ConfigDefinitionParams = Omit<ConfigDefinition, "categoryName" | "valueTypeName" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "createdByName" | "updatedByName">;

export const findConfigDefinitionPage = apiClient.createQueryFn(
  "find_config_definition_page",
  ({ post }) => async (queryParams: PaginatedQueryParams<ConfigDefinitionSearch>) => {
    const { params, pagination } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<ConfigDefinition>>(
      API_PATH,
      { data: createApiRequest("sys/config_definition", "find_page", params, pagination) }
    );
    return result.data;
  }
);

export const createConfigDefinition = apiClient.createMutationFn(
  "create_config_definition",
  ({ post }) => (params: ConfigDefinitionParams) => post(
    API_PATH,
    { data: createApiRequest("sys/config_definition", "create", params) }
  )
);

export const updateConfigDefinition = apiClient.createMutationFn(
  "update_config_definition",
  ({ post }) => (params: ConfigDefinitionParams) => post(
    API_PATH,
    { data: createApiRequest("sys/config_definition", "update", params) }
  )
);

export const deleteConfigDefinition = apiClient.createMutationFn(
  "delete_config_definition",
  ({ post }) => (row: ConfigDefinition) => post(
    API_PATH,
    { data: createApiRequest("sys/config_definition", "delete", { id: row.id }) }
  )
);
