import type {
  DefinedInitialDataInfiniteOptions,
  DefinedInitialDataOptions,
  DefinedUseInfiniteQueryResult,
  DefinedUseQueryResult,
  InfiniteData,
  MutationFilters,
  MutationState,
  QueriesResults,
  QueryFilters,
  UndefinedInitialDataInfiniteOptions,
  UndefinedInitialDataOptions,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult
} from "@tanstack/react-query";

import type { QueryKey } from "../api";

import {

  useInfiniteQuery as useInfiniteQueryInternal,
  useIsFetching as useIsFetchingInternal,
  useIsMutating as useIsMutatingInternal,
  useMutation as useMutationInternal,
  useMutationState as useMutationStateInternal,
  useQueries as useQueriesInternal,

  useQuery as useQueryInternal
} from "@tanstack/react-query";

// useQuery overloads
export function useQuery<TQueryFnData = unknown, TData = TQueryFnData, TParams = never>(
  options: DefinedInitialDataOptions<TQueryFnData, Error, TData, QueryKey<TParams>>
): DefinedUseQueryResult<NoInfer<TData>, Error>;
export function useQuery<TQueryFnData = unknown, TData = TQueryFnData, TParams = never>(
  options: UndefinedInitialDataOptions<TQueryFnData, Error, TData, QueryKey<TParams>>
    | UseQueryOptions<TQueryFnData, Error, TData, QueryKey<TParams>>
): UseQueryResult<NoInfer<TData>, Error>;

export function useQuery<TQueryFnData = unknown, TData = TQueryFnData, TParams = never>(
  options: UseQueryOptions<TQueryFnData, Error, TData, QueryKey<TParams>>
): UseQueryResult<NoInfer<TData>, Error> {
  return useQueryInternal(options);
}

// useInfiniteQuery overloads
export function useInfiniteQuery<TQueryFnData, TData = InfiniteData<TQueryFnData>, TParams = never, TPageParam = never>(
  options: DefinedInitialDataInfiniteOptions<TQueryFnData, Error, TData, QueryKey<TParams>, TPageParam>
): DefinedUseInfiniteQueryResult<TData, Error>;
export function useInfiniteQuery<TQueryFnData, TData = InfiniteData<TQueryFnData>, TParams = never, TPageParam = never>(
  options: UndefinedInitialDataInfiniteOptions<TQueryFnData, Error, TData, QueryKey<TParams>, TPageParam>
): UseInfiniteQueryResult<TData, Error>;

export function useInfiniteQuery<TQueryFnData, TData = InfiniteData<TQueryFnData>, TParams = never, TPageParam = never>(
  options: UseInfiniteQueryOptions<TQueryFnData, Error, TData, QueryKey<TParams>, TPageParam>
): UseInfiniteQueryResult<TData, Error> {
  return useInfiniteQueryInternal(options);
}

/**
 * Hook for executing multiple queries in parallel
 */
export function useQueries<T extends unknown[], TCombinedResult = QueriesResults<T>>(
  options: Parameters<typeof useQueriesInternal<T, TCombinedResult>>[0]
): TCombinedResult {
  return useQueriesInternal(options);
}

/**
 * Hook for executing mutations with automatic error typing
 */
export function useMutation<TData = unknown, TParams = void, TOnMutateResult = unknown>(
  options: UseMutationOptions<TData, Error, TParams, TOnMutateResult>
): UseMutationResult<TData, Error, TParams, TOnMutateResult> {
  return useMutationInternal(options);
}

/**
 * Hook for accessing mutation state across the application
 */
export function useMutationState<TResult = MutationState>(
  options?: Parameters<typeof useMutationStateInternal<TResult>>[0]
): TResult[] {
  return useMutationStateInternal(options);
}

/**
 * Hook for getting the count of currently fetching queries
 */
export function useIsFetching(filters?: QueryFilters): number {
  return useIsFetchingInternal(filters);
}

/**
 * Hook for getting the count of currently executing mutations
 */
export function useIsMutating(filters?: MutationFilters): number {
  return useIsMutatingInternal(filters);
}

export {
  matchMutation,
  matchQuery,
  skipToken as skipQueryToken,
  useQueryClient,
  useQueryErrorResetBoundary
} from "@tanstack/react-query";
