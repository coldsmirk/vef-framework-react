import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { DataOption, PaginationResult } from "@vef-framework-react/core";
import type { MaybeNull, SetOptional } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface User extends FullAuditedEntity {
  staffId?: MaybeNull<string>;
  username: string;
  password: string;
  name: string;
  isActive: boolean;
  isLocked: boolean;
  passwordUpdatedAt?: MaybeNull<string>;
  avatar?: MaybeNull<string>;
  gender: string;
  phoneNumber?: MaybeNull<string>;
  email?: MaybeNull<string>;
  remark?: MaybeNull<string>;
  roleIds?: string[];
  roleNames?: string[];
}

export interface UserSearch {
  keyword?: string;
}

export type UserCreateParams = User;

export type UserUpdateParams = SetOptional<UserCreateParams, "password">;

export const findUserOptions = apiClient.createQueryFn(
  "find_user_options",
  ({ post }) => async () => {
    const result = await post<DataOption[]>(
      API_PATH,
      { data: createApiRequest("sys/user", "find_options") }
    );
    return result.data;
  }
);

export const findUserPage = apiClient.createQueryFn(
  "find_user_page",
  ({ post }) => async (queryParams: PaginatedQueryParams<UserSearch>) => {
    const { params, pagination } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<User>>(
      API_PATH,
      { data: createApiRequest("sys/user", "find_page", params, pagination) }
    );
    return result.data;
  }
);

export const createUser = apiClient.createMutationFn(
  "create_user",
  ({ post }) => (params: UserCreateParams) => post(
    API_PATH,
    { data: createApiRequest("sys/user", "create", params) }
  )
);

export const updateUser = apiClient.createMutationFn(
  "update_user",
  ({ post }) => (params: UserUpdateParams) => post(
    API_PATH,
    { data: createApiRequest("sys/user", "update", params) }
  )
);

export const deleteUser = apiClient.createMutationFn(
  "delete_user",
  ({ post }) => (row: User) => post(
    API_PATH,
    { data: createApiRequest("sys/user", "delete", { id: row.id }) }
  )
);

export const deleteUsers = apiClient.createMutationFn(
  "delete_users",
  ({ post }) => (rows: User[]) => post(
    API_PATH,
    { data: createApiRequest("sys/user", "delete_many", { pks: rows.map(user => user.id) }) }
  )
);
