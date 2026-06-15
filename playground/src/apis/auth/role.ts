import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { DataOption, PaginationResult } from "@vef-framework-react/core";
import type { AnyObject, MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface Role extends FullAuditedEntity {
  orgId: string;
  name: string;
  isActive: boolean;
  remark?: MaybeNull<string>;
}

export interface RoleSearch {
  keyword?: string;
}

export type RoleParams = Omit<Role, "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "createdByName" | "updatedByName">;

export type DataScope = "A" | "S" | "D" | "DS" | "O" | "OS" | "C";

export interface DataScopeTarget {
  type: "O" | "D";
  id: string;
}

export interface RolePermission extends FullAuditedEntity {
  roleId: string;
  permissionId: string;
  dataScope: DataScope;
  dataScopeTargets?: DataScopeTarget[];
  customFilter?: AnyObject;
}

export interface RolePermissionItem {
  granted: boolean;
  dataScope?: DataScope;
  dataScopeTargets?: DataScopeTarget[];
  customFilter?: AnyObject;
}

export interface RolePermissionParams {
  roleId: string;
  permissions: Record<string, RolePermissionItem>;
}

export interface RoleUserSearch {
  roleId?: string;
  keyword?: string;
  deptId?: string;
}

export interface RoleUserItem {
  userId: string;
  username: string;
  name: string;
  gender: string;
  isActive: boolean;
  isLocked: boolean;
  deptId?: MaybeNull<string>;
  deptName?: MaybeNull<string>;
}

export interface RoleUserParams {
  roleId: string;
  userIds: string[];
}

export const findRoleOptions = apiClient.createQueryFn(
  "find_role_options",
  ({ post }) => async () => {
    const result = await post<DataOption[]>(
      API_PATH,
      { data: createApiRequest("sys/role", "find_options") }
    );
    return result.data;
  }
);

export const findRolePage = apiClient.createQueryFn(
  "find_role_page",
  ({ post }) => async (queryParams: PaginatedQueryParams<RoleSearch>) => {
    const { params, pagination } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<Role>>(
      API_PATH,
      { data: createApiRequest("sys/role", "find_page", params, pagination) }
    );
    return result.data;
  }
);

export const createRole = apiClient.createMutationFn(
  "create_role",
  ({ post }) => (params: RoleParams) => post(
    API_PATH,
    { data: createApiRequest("sys/role", "create", params) }
  )
);

export const updateRole = apiClient.createMutationFn(
  "update_role",
  ({ post }) => (params: RoleParams) => post(
    API_PATH,
    { data: createApiRequest("sys/role", "update", params) }
  )
);

export const deleteRole = apiClient.createMutationFn(
  "delete_role",
  ({ post }) => (row: Role) => post(
    API_PATH,
    { data: createApiRequest("sys/role", "delete", { id: row.id }) }
  )
);

export const findPermissionOptions = apiClient.createQueryFn(
  "find_permission_options",
  ({ post }) => async () => {
    const result = await post<DataOption[]>(
      API_PATH,
      { data: createApiRequest("sys/menu", "find_permission_options") }
    );
    return result.data;
  }
);

export const findRolePermissions = apiClient.createQueryFn(
  "find_role_permissions",
  ({ post }) => async (roleId: string) => {
    const result = await post<RolePermission[]>(
      API_PATH,
      { data: createApiRequest("sys/role", "find_permissions", { roleId }) }
    );
    return result.data;
  }
);

export const saveRolePermissions = apiClient.createMutationFn(
  "save_role_permissions",
  ({ post }) => (params: RolePermissionParams) => post(
    API_PATH,
    {
      data: createApiRequest("sys/role", "save_role_permissions", {
        roleId: params.roleId,
        permissions: Object.entries(params.permissions)
          .filter(([, permission]) => permission.granted)
          .map(([permissionId, { granted: _, ...permission }]) => {
            return {
              permissionId,
              ...permission
            };
          })
      })
    }
  )
);

export const findRoleUsers = apiClient.createQueryFn(
  "find_role_users",
  ({ post }) => async (queryParams: PaginatedQueryParams<RoleUserSearch>) => {
    const { pagination, params } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<RoleUserItem>>(
      API_PATH,
      { data: createApiRequest("sys/role", "find_users", params, pagination) }
    );
    return result.data;
  }
);

export const findRoleAvailableUsers = apiClient.createQueryFn(
  "find_role_available_users",
  ({ post }) => async (queryParams: PaginatedQueryParams<RoleUserSearch>) => {
    const { pagination, params } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<RoleUserItem>>(
      API_PATH,
      { data: createApiRequest("sys/role", "find_available_users", params, pagination) }
    );
    return result.data;
  }
);

export const addRoleUsers = apiClient.createMutationFn(
  "add_role_users",
  ({ post }) => (params: RoleUserParams) => post(
    API_PATH,
    { data: createApiRequest("sys/role", "add_users", params) }
  )
);

export const removeRoleUsers = apiClient.createMutationFn(
  "remove_role_users",
  ({ post }) => (params: RoleUserParams) => post(
    API_PATH,
    { data: createApiRequest("sys/role", "remove_users", params) }
  )
);
