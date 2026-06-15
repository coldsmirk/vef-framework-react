import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { PaginationResult } from "@vef-framework-react/core";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface IdMapping extends FullAuditedEntity {
  tableName: string;
  externalApp: string;
  externalAppName?: string;
  fromId: string;
  toId: string;
}

export interface IdMappingSearch {
  keyword?: string;
}

export type IdMappingParams = Omit<IdMapping, "externalAppName" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "createdByName" | "updatedByName">;

export const findIdMappingPage = apiClient.createQueryFn(
  "find_id_mapping_page",
  ({ post }) => async (queryParams: PaginatedQueryParams<IdMappingSearch>) => {
    const { params, pagination } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<IdMapping>>(
      API_PATH,
      { data: createApiRequest("md/id_mapping", "find_page", params, pagination) }
    );
    return result.data;
  }
);

export const createIdMapping = apiClient.createMutationFn(
  "create_id_mapping",
  ({ post }) => (params: IdMappingParams) => post(
    API_PATH,
    { data: createApiRequest("md/id_mapping", "create", params) }
  )
);

export const updateIdMapping = apiClient.createMutationFn(
  "update_id_mapping",
  ({ post }) => (params: IdMappingParams) => post(
    API_PATH,
    { data: createApiRequest("md/id_mapping", "update", params) }
  )
);

export const deleteIdMapping = apiClient.createMutationFn(
  "delete_id_mapping",
  ({ post }) => (row: IdMapping) => post(
    API_PATH,
    { data: createApiRequest("md/id_mapping", "delete", { id: row.id }) }
  )
);
