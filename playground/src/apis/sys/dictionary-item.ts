import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { DataOption, PaginationResult } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface DictionaryItem extends FullAuditedEntity {
  dictionaryId: string;
  name: string;
  code: string;
  sortOrder: number;
  remark?: MaybeNull<string>;
  isActive: boolean;
  isVisible: boolean;
  meta?: MaybeNull<Record<string, any>>;
}

export interface DictionaryItemSearch {
  keyword?: string;
}

export type DictionaryItemParams = Omit<DictionaryItem, "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "createdByName" | "updatedByName">;

export const findDictionaryItems = apiClient.createQueryFn(
  "find_dictionary_items",
  ({ post }) => async (key: string) => {
    const result = await post<Record<string, DataOption[]>>(
      API_PATH,
      { data: createApiRequest("sys/dictionary_item", "find_items", { keys: [key] }) }
    );
    return result.data[key] ?? [];
  }
);

export const findDictionaryItemsBatch = apiClient.createQueryFn(
  "find_dictionary_items_batch",
  ({ post }) => async (keys: string[]) => {
    const result = await post<Record<string, DataOption[]>>(
      API_PATH,
      { data: createApiRequest("sys/dictionary_item", "find_items", { keys }) }
    );
    return result.data;
  }
);

export const findDictionaryItemPage = apiClient.createQueryFn(
  "find_dictionary_item_page",
  ({ post }) => async (queryParams: PaginatedQueryParams<DictionaryItemSearch, { dictionaryId?: string }>) => {
    const { params, pagination } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<DictionaryItem>>(
      API_PATH,
      { data: createApiRequest("sys/dictionary_item", "find_page", params, pagination) }
    );
    return result.data;
  }
);

export const createDictionaryItem = apiClient.createMutationFn(
  "create_dictionary_item",
  ({ post }) => (params: DictionaryItemParams) => post(
    API_PATH,
    { data: createApiRequest("sys/dictionary_item", "create", params) }
  )
);

export const updateDictionaryItem = apiClient.createMutationFn(
  "update_dictionary_item",
  ({ post }) => (params: DictionaryItemParams) => post(
    API_PATH,
    { data: createApiRequest("sys/dictionary_item", "update", params) }
  )
);

export const deleteDictionaryItem = apiClient.createMutationFn(
  "delete_dictionary_item",
  ({ post }) => (row: DictionaryItem) => post(
    API_PATH,
    { data: createApiRequest("sys/dictionary_item", "delete", { id: row.id }) }
  )
);

export const deleteManyDictionaryItem = apiClient.createMutationFn(
  "delete_many_dictionary_item",
  ({ post }) => (rows: DictionaryItem[]) => post(
    API_PATH,
    { data: createApiRequest("sys/dictionary_item", "delete_many", { pks: rows.map(item => item.id) }) }
  )
);
