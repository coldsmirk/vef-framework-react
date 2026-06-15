import type { QueryParams } from "@vef-framework-react/components";
import type { DataOption } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface Organization extends FullAuditedEntity {
  parentId?: MaybeNull<string>;
  type: string;
  typeName?: string;
  code: string;
  name: string;
  shortName: string;
  introduction?: MaybeNull<string>;
  logo?: MaybeNull<string>;
  hospitalLevel?: MaybeNull<string>;
  isActive: boolean;
  sortOrder: number;
  remark?: MaybeNull<string>;
  children?: Organization[];
}

export interface OrganizationSearch {
  keyword?: string;
}

export type OrganizationParams = Omit<Organization, "typeName" | "children" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "createdByName" | "updatedByName">;

export const findOrganizationTreeOptions = apiClient.createQueryFn(
  "find_organization_tree_options",
  ({ post }) => async () => {
    const result = await post<DataOption[]>(
      API_PATH,
      { data: createApiRequest("md/organization", "find_tree_options") }
    );
    return result.data;
  }
);

export const findOrganizationTree = apiClient.createQueryFn(
  "find_organization_tree",
  ({ post }) => async (queryParams: QueryParams<OrganizationSearch>) => {
    const { params } = extractQueryParams(queryParams);
    const result = await post<Organization[]>(
      API_PATH,
      { data: createApiRequest("md/organization", "find_tree", params) }
    );
    return result.data;
  }
);

export const createOrganization = apiClient.createMutationFn(
  "create_organization",
  ({ post }) => (params: OrganizationParams) => post(
    API_PATH,
    { data: createApiRequest("md/organization", "create", params) }
  )
);

export const updateOrganization = apiClient.createMutationFn(
  "update_organization",
  ({ post }) => (params: OrganizationParams) => post(
    API_PATH,
    { data: createApiRequest("md/organization", "update", params) }
  )
);

export const deleteOrganization = apiClient.createMutationFn(
  "delete_organization",
  ({ post }) => (row: Organization) => post(
    API_PATH,
    { data: createApiRequest("md/organization", "delete", { id: row.id }) }
  )
);
