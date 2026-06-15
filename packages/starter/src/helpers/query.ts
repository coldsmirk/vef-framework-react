import type { PaginationParams } from "@vef-framework-react/core";
import type { AnyObject, MaybeUndefined } from "@vef-framework-react/shared";

import type { OrderSpec } from "../types";

import { SYMBOL_PAGINATION, SYMBOL_SORT } from "@vef-framework-react/components";

export function noopMutationFn<TResult = unknown, TArgs extends unknown[] = unknown[]>(
  ..._args: TArgs
): Promise<TResult> {
  return Promise.resolve(undefined as TResult);
}

noopMutationFn.key = "__noop_mutation_fn";

export function extractQueryParams<TParams extends AnyObject>(
  queryParams: TParams
): {
  params: Omit<TParams, typeof SYMBOL_PAGINATION | typeof SYMBOL_SORT>;
  pagination: MaybeUndefined<PaginationParams>;
  sort: MaybeUndefined<OrderSpec[]>;
} {
  const {
    [SYMBOL_PAGINATION]: pagination,
    [SYMBOL_SORT]: sort,
    ...params
  } = queryParams;

  return {
    params: params as Omit<TParams, typeof SYMBOL_PAGINATION | typeof SYMBOL_SORT>,
    pagination: pagination as MaybeUndefined<PaginationParams>,
    sort: sort as MaybeUndefined<OrderSpec[]>
  };
}
