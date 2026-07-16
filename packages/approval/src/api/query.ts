import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { AnyObject } from "@vef-framework-react/shared";

import { SYMBOL_PAGINATION } from "@vef-framework-react/components";

/**
 * The framework RPC endpoint every approval call posts to.
 */
export const API_PATH = "/api";

/**
 * Fold ProTable's symbol-keyed pagination into the flat `page` / `pageSize`
 * request shape the approval RPC queries expect. The sort symbol is left on
 * the spread copy; JSON serialization drops it, so it never reaches the wire.
 */
export function toPagedParams<TSearch extends AnyObject>(
  queryParams: PaginatedQueryParams<TSearch>
): Omit<PaginatedQueryParams<TSearch>, typeof SYMBOL_PAGINATION> & { page?: number; pageSize?: number } {
  const { [SYMBOL_PAGINATION]: pagination, ...params } = queryParams;

  return {
    ...params,
    page: pagination?.page,
    pageSize: pagination?.size
  };
}
