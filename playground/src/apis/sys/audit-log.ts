import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { PaginationResult } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export interface AuditLog extends FullAuditedEntity {
  userId: string;
  userAgent?: MaybeNull<string>;
  userName: string;
  apiResource: string;
  apiAction: string;
  apiVersion: string;
  requestIp: string;
  requestId: string;
  requestParams: Record<string, any>;
  requestMeta: Record<string, any>;
  resultCode: number;
  resultMessage: string;
  resultData?: MaybeNull<Record<string, any>>;
  elapsedTime: number;
}

export interface AuditLogSearch {
  keyword?: string;
}

export const findAuditLogPage = apiClient.createQueryFn(
  "find_audit_log_page",
  ({ post }) => async (queryParams: PaginatedQueryParams<AuditLogSearch>) => {
    const { params, pagination } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<AuditLog>>(
      API_PATH,
      { data: createApiRequest("sys/audit_log", "find_page", params, pagination) }
    );
    return result.data;
  }
);
