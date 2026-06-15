import type { MutationFunction as MutationFunctionInternal, QueryFunction as QueryFunctionInternal } from "@tanstack/react-query";
import type { If, IsNever, Key } from "@vef-framework-react/shared";

import type { HttpClientOptions } from "../http";
import type { QueryClientOptions } from "../query";

/**
 * The options for the API client.
 */
export interface ApiClientOptions {
  /**
   * The options for the HTTP client.
   */
  http: HttpClientOptions;
  /**
   * The options for the query client.
   */
  query?: QueryClientOptions;
}

/**
 * The key of the query.
 *
 * @param TParams - The parameters of the query.
 */
export type QueryKey<TParams = never> = readonly [Key, ...If<IsNever<TParams>, [], [TParams]>];

/**
 * The query function.
 *
 * @param TResult - The result of the query.
 * @param TParams - The parameters of the query.
 * @param TPageParam - The page parameter of the query.
 */
export interface QueryFunction<TData = unknown, TParams = never, TPageParam = never> extends QueryFunctionInternal<TData, QueryKey<TParams>, TPageParam> {
  /**
   * The API identifier.
   */
  key: Key;
}

/**
 * The mutation function.
 *
 * @param TResult - The result of the mutation.
 * @param TParams - The parameters of the mutation.
 */
export interface MutationFunction<TData = unknown, TParams = never> extends MutationFunctionInternal<TData, TParams> {
  /**
   * The API identifier.
   */
  key: Key;
}

/**
 * The wire-level envelope every framework RPC call shares. `resource` and
 * `action` identify the target operation on the Go side; `version` pins the
 * action's compatibility profile (defaults to `v1`); `params` and `meta`
 * carry the per-call payload and metadata.
 */
export interface ApiRequest<
  P extends object = Record<string, unknown>,
  M extends object = Record<string, unknown>
> {
  /**
   * The resource the action targets (e.g. `"sys/storage"`).
   */
  resource: string;
  /**
   * The action to invoke on the resource (e.g. `"init_upload"`).
   */
  action: string;
  /**
   * The action's compatibility version. Defaults to `"v1"` when omitted at
   * the helper level.
   */
  version: string;
  /**
   * Per-call parameters. Shape is defined by the target action.
   */
  params?: P;
  /**
   * Per-call metadata (e.g. pagination). Shape is defined by the target
   * action.
   */
  meta?: M;
}
