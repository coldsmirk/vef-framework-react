import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { PaginationResult } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface SerialNoRule extends FullAuditedEntity {
  key: string;
  name: string;
  prefix?: MaybeNull<string>;
  suffix?: MaybeNull<string>;
  dateFormat?: MaybeNull<string>;
  seqLength: number;
  seqStep: number;
  resetCycle: string;
  currentValue: number;
  lastResetAt?: MaybeNull<string>;
  isActive: boolean;
  remark?: MaybeNull<string>;
}

export interface SerialNoRuleSearch {
  keyword?: string;
}

export interface SerialNoRuleParams {
  id?: string;
  key: string;
  name: string;
  prefix?: MaybeNull<string>;
  suffix?: MaybeNull<string>;
  dateFormat?: MaybeNull<string>;
  seqLength: number;
  seqStep: number;
  resetCycle: string;
  isActive: boolean;
  remark?: MaybeNull<string>;
}

export const findSerialNoRulePage = apiClient.createQueryFn(
  "find_serial_no_rule_page",
  ({ post }) => async (queryParams: PaginatedQueryParams<SerialNoRuleSearch>) => {
    const { params, pagination } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<SerialNoRule>>(
      API_PATH,
      { data: createApiRequest("sys/serial_no_rule", "find_page", params, pagination) }
    );
    return result.data;
  }
);

export const createSerialNoRule = apiClient.createMutationFn(
  "create_serial_no_rule",
  ({ post }) => (params: SerialNoRuleParams) => post(
    API_PATH,
    { data: createApiRequest("sys/serial_no_rule", "create", params) }
  )
);

export const updateSerialNoRule = apiClient.createMutationFn(
  "update_serial_no_rule",
  ({ post }) => (params: SerialNoRuleParams) => post(
    API_PATH,
    { data: createApiRequest("sys/serial_no_rule", "update", params) }
  )
);

export const deleteSerialNoRule = apiClient.createMutationFn(
  "delete_serial_no_rule",
  ({ post }) => (row: SerialNoRule) => post(
    API_PATH,
    { data: createApiRequest("sys/serial_no_rule", "delete", { id: row.id }) }
  )
);
