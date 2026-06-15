import type { QueryParams } from "@vef-framework-react/components";
import type { DataOption } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface District extends FullAuditedEntity {
  parentId?: MaybeNull<string>;
  code: string;
  name: string;
  shortName?: MaybeNull<string>;
  level: number;
  spellCode?: MaybeNull<string>;
  strokeCode?: MaybeNull<string>;
  postcode?: MaybeNull<string>;
  sortOrder: number;
  isActive: boolean;
  remark?: MaybeNull<string>;
  children?: District[];
}

export interface DistrictSearch {
  keyword?: string;
}

export interface DistrictParams {
  id?: string;
  parentId?: MaybeNull<string>;
  code: string;
  name: string;
  shortName?: MaybeNull<string>;
  level: number;
  spellCode?: MaybeNull<string>;
  strokeCode?: MaybeNull<string>;
  postcode?: MaybeNull<string>;
  sortOrder: number;
  isActive: boolean;
  remark?: MaybeNull<string>;
}

export const findDistrictTree = apiClient.createQueryFn(
  "find_district_tree",
  ({ post }) => async (queryParams: QueryParams<DistrictSearch>) => {
    const { params } = extractQueryParams(queryParams);
    const result = await post<District[]>(
      API_PATH,
      { data: createApiRequest("md/district", "find_tree", params) }
    );
    return result.data;
  }
);

export const findDistrictTreeOptions = apiClient.createQueryFn(
  "find_district_tree_options",
  ({ post }) => async () => {
    const result = await post<DataOption[]>(
      API_PATH,
      { data: createApiRequest("md/district", "find_tree_options") }
    );
    return result.data;
  }
);

export const createDistrict = apiClient.createMutationFn(
  "create_district",
  ({ post }) => (params: DistrictParams) => post(
    API_PATH,
    { data: createApiRequest("md/district", "create", params) }
  )
);

export const updateDistrict = apiClient.createMutationFn(
  "update_district",
  ({ post }) => (params: DistrictParams) => post(
    API_PATH,
    { data: createApiRequest("md/district", "update", params) }
  )
);

export const deleteDistrict = apiClient.createMutationFn(
  "delete_district",
  ({ post }) => (row: District) => post(
    API_PATH,
    { data: createApiRequest("md/district", "delete", { id: row.id }) }
  )
);
