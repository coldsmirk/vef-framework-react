import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { DataOption, PaginationResult } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface App extends FullAuditedEntity {
  name: string;
  icon?: MaybeNull<string>;
  url?: MaybeNull<string>;
  isActive: boolean;
  sortOrder: number;
  remark?: MaybeNull<string>;
  meta?: MaybeNull<Record<string, any>>;
}

export interface AppSearch {
  keyword?: string;
}

export type AppParams = Omit<App, "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "createdByName" | "updatedByName">;

export const findAppOptions = apiClient.createQueryFn(
  "find_app_options",
  ({ post }) => async () => {
    const result = await post<DataOption[]>(
      API_PATH,
      { data: createApiRequest("sys/app", "find_options") }
    );
    return result.data;
  }
);

export const findAppPage = apiClient.createQueryFn(
  "find_app_page",
  ({ post }) => async (queryParams: PaginatedQueryParams<AppSearch>) => {
    const { params, pagination } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<App>>(
      API_PATH,
      { data: createApiRequest("sys/app", "find_page", params, pagination) }
    );
    return result.data;
  }
);

export const createApp = apiClient.createMutationFn(
  "create_app",
  ({ post }) => (params: AppParams) => post(
    API_PATH,
    { data: createApiRequest("sys/app", "create", params) }
  )
);

export const updateApp = apiClient.createMutationFn(
  "update_app",
  ({ post }) => (params: AppParams) => post(
    API_PATH,
    { data: createApiRequest("sys/app", "update", params) }
  )
);

export const deleteApp = apiClient.createMutationFn(
  "delete_app",
  ({ post }) => (row: App) => post(
    API_PATH,
    { data: createApiRequest("sys/app", "delete", { id: row.id }) }
  )
);

export const deleteApps = apiClient.createMutationFn(
  "delete_apps",
  ({ post }) => (rows: App[]) => post(
    API_PATH,
    { data: createApiRequest("sys/app", "delete_many", { pks: rows.map(app => app.id) }) }
  )
);
