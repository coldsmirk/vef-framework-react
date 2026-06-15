import type { QueryParams } from "@vef-framework-react/components";
import type { DataOption } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface Menu extends FullAuditedEntity {
  appId: string;
  parentId?: MaybeNull<string>;
  type: "D" | "M" | "V" | "P" | "R";
  typeName?: string;
  name: string;
  icon?: MaybeNull<string>;
  path?: MaybeNull<string>;
  permissionCode?: MaybeNull<string>;
  isActive: boolean;
  sortOrder: number;
  remark?: MaybeNull<string>;
  meta?: MaybeNull<Record<string, any>>;
  children?: Menu[];
}

export interface MenuSearch {
  appId?: string;
  keyword?: string;
}

export type MenuParams = Omit<Menu, "typeName" | "children" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "createdByName" | "updatedByName">;

export const findMenuTreeOptions = apiClient.createQueryFn(
  "find_menu_tree_options",
  ({ post }) => async (queryParams: QueryParams<MenuSearch>) => {
    const { params } = extractQueryParams(queryParams);
    const result = await post<DataOption[]>(
      API_PATH,
      { data: createApiRequest("sys/menu", "find_tree_options", params) }
    );
    return result.data;
  }
);

export const findMenuTree = apiClient.createQueryFn(
  "find_menu_tree",
  ({ post }) => async (queryParams: QueryParams<MenuSearch>) => {
    const { params } = extractQueryParams(queryParams);
    const result = await post<Menu[]>(
      API_PATH,
      { data: createApiRequest("sys/menu", "find_tree", params) }
    );
    return result.data;
  }
);

export const createMenu = apiClient.createMutationFn(
  "create_menu",
  ({ post }) => (params: MenuParams) => post(
    API_PATH,
    { data: createApiRequest("sys/menu", "create", params) }
  )
);

export const updateMenu = apiClient.createMutationFn(
  "update_menu",
  ({ post }) => (params: MenuParams) => post(
    API_PATH,
    { data: createApiRequest("sys/menu", "update", params) }
  )
);

export const deleteMenu = apiClient.createMutationFn(
  "delete_menu",
  ({ post }) => (row: Menu) => post(
    API_PATH,
    { data: createApiRequest("sys/menu", "delete", { id: row.id }) }
  )
);
