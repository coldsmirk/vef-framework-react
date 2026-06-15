import type { QueryParams } from "@vef-framework-react/components";
import type { DataOption } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface Department extends FullAuditedEntity {
  parentId?: MaybeNull<string>;
  orgId: string;
  name: string;
  shortName: string;
  level: string;
  levelName?: string;
  type: string;
  typeName?: string;
  introduction?: MaybeNull<string>;
  location?: MaybeNull<string>;
  isActive: boolean;
  sortOrder: number;
  remark?: MaybeNull<string>;
  children?: Department[];
}

export interface DepartmentSearch {
  keyword?: string;
}

export type DepartmentParams = Omit<Department, "levelName" | "typeName" | "children" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "createdByName" | "updatedByName">;

export const findDepartmentTreeOptions = apiClient.createQueryFn(
  "find_department_tree_options",
  ({ post }) => async (queryParams: QueryParams<DepartmentSearch, { orgId?: string }>) => {
    const { params } = extractQueryParams(queryParams);
    const result = await post<DataOption[]>(
      API_PATH,
      { data: createApiRequest("md/department", "find_tree_options", params) }
    );
    return result.data;
  }
);

export const findDepartmentTree = apiClient.createQueryFn(
  "find_department_tree",
  ({ post }) => async (queryParams: QueryParams<DepartmentSearch, { orgId?: string }>) => {
    const { params } = extractQueryParams(queryParams);
    const result = await post<Department[]>(
      API_PATH,
      { data: createApiRequest("md/department", "find_tree", params) }
    );
    return result.data;
  }
);

export const createDepartment = apiClient.createMutationFn(
  "create_department",
  ({ post }) => (params: DepartmentParams) => post(
    API_PATH,
    { data: createApiRequest("md/department", "create", params) }
  )
);

export const updateDepartment = apiClient.createMutationFn(
  "update_department",
  ({ post }) => (params: DepartmentParams) => post(
    API_PATH,
    { data: createApiRequest("md/department", "update", params) }
  )
);

export const deleteDepartment = apiClient.createMutationFn(
  "delete_department",
  ({ post }) => (row: Department) => post(
    API_PATH,
    { data: createApiRequest("md/department", "delete", { id: row.id }) }
  )
);
