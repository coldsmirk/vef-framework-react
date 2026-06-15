import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { PaginationResult } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface LoginLog extends FullAuditedEntity {
  userId?: MaybeNull<string>;
  username?: MaybeNull<string>;
  userName?: MaybeNull<string>;
  loginIp?: MaybeNull<string>;
  userAgent: string;
  isOk: boolean;
  failReason?: MaybeNull<string>;
  traceId?: MaybeNull<string>;
}

export interface LoginLogSearch {
  keyword?: string;
  createdAt?: [string, string];
}

export const findLoginLogPage = apiClient.createQueryFn(
  "find_login_log_page",
  ({ post }) => async (queryParams: PaginatedQueryParams<LoginLogSearch>) => {
    const { params, pagination } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<LoginLog>>(
      API_PATH,
      { data: createApiRequest("sys/login_log", "find_page", params, pagination) }
    );
    return result.data;
  }
);
