import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { PaginationParams } from "@vef-framework-react/core";
import type { AnyObject } from "@vef-framework-react/shared";

import { SYMBOL_PAGINATION } from "@vef-framework-react/components";

/**
 * The framework RPC endpoint every management call posts to.
 */
export const API_PATH = "/api";

/**
 * Split ProTable's symbol-keyed query params into the plain search params and
 * the pagination metadata. The sort symbol is left on `params`; JSON
 * serialization drops it, so it never reaches the wire.
 */
export function splitQueryParams<TSearch extends AnyObject>(
  queryParams: PaginatedQueryParams<TSearch>
): {
  params: Omit<PaginatedQueryParams<TSearch>, typeof SYMBOL_PAGINATION>;
  pagination: PaginationParams | undefined;
} {
  const { [SYMBOL_PAGINATION]: pagination, ...params } = queryParams;

  return { params, pagination };
}
