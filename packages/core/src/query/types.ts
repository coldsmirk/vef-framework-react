import type {
  DefinedInitialDataOptions as DefinedInitialDataOptionsInternal,
  DefinedUseQueryResult as DefinedUseQueryResultInternal,
  QueryKeyHashFunction as QueryKeyHashFunctionInternal,
  UndefinedInitialDataOptions as UndefinedInitialDataOptionsInternal,
  UseInfiniteQueryOptions as UseInfiniteQueryOptionsInternal,
  UseMutationResult as UseMutationResultInternal,
  UseQueryOptions as UseQueryOptionsInternal,
  UseQueryResult as UseQueryResultInternal
} from "@tanstack/react-query";
import type { MaybeUndefined } from "@vef-framework-react/shared";

import type { QueryKey } from "../api";

// Module augmentation for mutation meta
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /**
       * Query keys to invalidate on successful mutation
       */
      invalidates?: Array<QueryKey<never> | QueryKey<unknown>>;
      /**
       * Whether to show success feedback (default: true)
       */
      shouldShowSuccessFeedback?: boolean;
    };
  }
}

/**
 * Options for creating a QueryClient instance
 */
export interface QueryClientOptions {
  /**
   * Time in ms before data is considered stale (default: 5000)
   */
  staleTime?: number;
  /**
   * Time in ms before inactive queries are garbage collected (default: 300000)
   */
  gcTime?: number;
  /**
   * Callback to display success message from mutation response
   */
  showSuccessMessage?: (message: string) => void;
}

// Retry configuration types
export type ShouldRetryFunction = (failureCount: number, error: Error) => boolean;
export type RetryValue = boolean | number | ShouldRetryFunction;
export type RetryDelayFunction = (failureCount: number, error: Error) => number;
export type RetryDelayValue = number | RetryDelayFunction;
export type PlaceholderDataFunction<TData = unknown> = (previousData: MaybeUndefined<TData>) => MaybeUndefined<TData>;

export interface RefetchOptions {
  cancelRefetch?: boolean;
}

// Query type aliases with fixed Error type
export type QueryKeyHashFunction<TParams = never> = QueryKeyHashFunctionInternal<QueryKey<TParams>>;
export type UseQueryResult<TData = unknown> = UseQueryResultInternal<TData, Error>;
export type DefinedUseQueryResult<TData = unknown> = DefinedUseQueryResultInternal<TData, Error>;
export type UseQueryOptions<TQueryFnData = unknown, TData = TQueryFnData, TParams = never>
  = UseQueryOptionsInternal<TQueryFnData, Error, TData, QueryKey<TParams>>;
export type DefinedInitialDataOptions<TQueryFnData = unknown, TData = TQueryFnData, TParams = never>
  = DefinedInitialDataOptionsInternal<TQueryFnData, Error, TData, QueryKey<TParams>>;
export type UndefinedInitialDataOptions<TQueryFnData = unknown, TData = TQueryFnData, TParams = never>
  = UndefinedInitialDataOptionsInternal<TQueryFnData, Error, TData, QueryKey<TParams>>;
export type UseInfiniteQueryOptions<TQueryFnData, TData = TQueryFnData, TParams = never, TPageParam = never>
  = UseInfiniteQueryOptionsInternal<TQueryFnData, Error, TData, QueryKey<TParams>, TPageParam>;

// Mutation type alias with fixed Error type
export type UseMutationResult<TData = unknown, TParams = unknown, TOnMutateResult = unknown>
  = UseMutationResultInternal<TData, Error, TParams, TOnMutateResult>;

// Re-exports from @tanstack/react-query
export type {
  InitialDataFunction,
  MutationFunctionContext,
  MutationMeta,
  MutationScope,
  QueryMeta,
  SkipToken as SkipQueryToken,
  StaleTime
} from "@tanstack/react-query";
