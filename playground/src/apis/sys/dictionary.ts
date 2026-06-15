import type { QueryParams } from "@vef-framework-react/components";
import type { DataOption } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface Dictionary extends FullAuditedEntity {
  parentId?: MaybeNull<string>;
  type: string;
  typeName?: string;
  name: string;
  key: string;
  isSystem: boolean;
  isActive: boolean;
  remark?: MaybeNull<string>;
  sortOrder: number;
  meta?: MaybeNull<Record<string, any>>;
}

export interface DictionarySearch {
  keyword?: string;
}

export type DictionaryParams = Omit<Dictionary, "typeName" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "createdByName" | "updatedByName">;

export const findDictionaryTreeOptions = apiClient.createQueryFn(
  "find_dictionary_tree_options",
  ({ post }) => async () => {
    const result = await post<DataOption[]>(
      API_PATH,
      { data: createApiRequest("sys/dictionary", "find_tree_options", undefined, { metaColumns: ["type"] }) }
    );
    return result.data;
  }
);

export const findDictionaryTree = apiClient.createQueryFn(
  "find_dictionary_tree",
  ({ post }) => async (queryParams: QueryParams<DictionarySearch>) => {
    const { params } = extractQueryParams(queryParams);
    const result = await post<Dictionary[]>(
      API_PATH,
      { data: createApiRequest("sys/dictionary", "find_tree", params) }
    );
    return result.data;
  }
);

export const createDictionary = apiClient.createMutationFn(
  "create_dictionary",
  ({ post }) => (params: DictionaryParams) => post(
    API_PATH,
    { data: createApiRequest("sys/dictionary", "create", params) }
  )
);

export const updateDictionary = apiClient.createMutationFn(
  "update_dictionary",
  ({ post }) => (params: DictionaryParams) => post(
    API_PATH,
    { data: createApiRequest("sys/dictionary", "update", params) }
  )
);

export const deleteDictionary = apiClient.createMutationFn(
  "delete_dictionary",
  ({ post }) => (row: Dictionary) => post(
    API_PATH,
    { data: createApiRequest("sys/dictionary", "delete", { id: row.id }) }
  )
);
