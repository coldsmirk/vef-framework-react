import type { FetchQueryOptions, MutationOptions, QueryClient, QueryFunctionContext, QueryMeta } from "@tanstack/react-query";
import type { Awaitable, Except, If, IsNever, IsOptional } from "@vef-framework-react/shared";
import type { GenericAbortSignal } from "axios";

import type { HttpClient, RequestOptions } from "../http";
import type { ApiClientOptions, MutationFunction, QueryFunction, QueryKey } from "./types";

import { isFunction } from "@vef-framework-react/shared";

import { createHttpClient } from "../http";
import { createQueryClient } from "../query";
import { HTTP_CLIENT, PROXIED_METHODS, QUERY_CLIENT } from "./constants";

/**
 * Attach a readonly key property to a function.
 */
function attachKey<T extends Function>(fn: T, key: string): T {
  Object.defineProperty(fn, "key", {
    value: key,
    configurable: false,
    writable: false,
    enumerable: false
  });
  return fn;
}

/**
 * API client that combines HttpClient and QueryClient for data fetching.
 */
export class ApiClient {
  readonly #httpClient: Readonly<HttpClient>;
  readonly #queryClient: QueryClient;
  #currentSignal?: GenericAbortSignal;

  constructor(options: ApiClientOptions) {
    const { http, query } = options;

    this.#queryClient = createQueryClient(query);
    this.#httpClient = this.createProxiedHttpClient(createHttpClient(http));
  }

  /**
   * Create a proxied HttpClient that injects the current abort signal.
   */
  private createProxiedHttpClient(httpClient: Readonly<HttpClient>): Readonly<HttpClient> {
    const proxyCache = new Map<string | symbol, Function>();

    return new Proxy(httpClient, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);

        if (!isFunction(value)) {
          return value;
        }

        if (!proxyCache.has(prop)) {
          const handler = PROXIED_METHODS.has(prop as string)
            ? (url: string, options: RequestOptions) => value.apply(target, [url, { ...options, signal: this.#currentSignal }])
            : (...args: unknown[]) => value.apply(target, args);

          proxyCache.set(prop, handler);
        }

        return proxyCache.get(prop);
      }
    });
  }

  /**
   * Access the underlying QueryClient.
   */
  get [QUERY_CLIENT](): QueryClient {
    return this.#queryClient;
  }

  /**
   * Access the underlying HttpClient.
   */
  get [HTTP_CLIENT](): Readonly<HttpClient> {
    return this.#httpClient;
  }

  /**
   * Create a query function with automatic signal injection.
   */
  public createQueryFn<TResult = unknown, TParams = never, TPageParam = never>(
    key: string,
    factory: (http: Readonly<HttpClient>) => (queryParams: TParams, pageParam: TPageParam, meta?: QueryMeta) => Awaitable<TResult>
  ): QueryFunction<TResult, TParams, TPageParam> {
    const queryFn = factory(this.#httpClient);

    const wrapperFn = (context: QueryFunctionContext<QueryKey<TParams>, TPageParam>): Awaitable<TResult> => {
      const {
        queryKey,
        signal,
        pageParam,
        meta
      } = context;
      const [, params] = queryKey;

      try {
        this.#currentSignal = signal;
        return queryFn(params as TParams, pageParam as TPageParam, meta);
      } finally {
        this.#currentSignal = undefined;
      }
    };

    return attachKey(wrapperFn, key) as QueryFunction<TResult, TParams, TPageParam>;
  }

  /**
   * Create a mutation function.
   */
  public createMutationFn<TResult = unknown, TParams = never>(
    key: string,
    factory: (http: Readonly<HttpClient>) => (params: TParams) => Awaitable<TResult>
  ): MutationFunction<TResult, TParams> {
    const mutationFn = factory(this.#httpClient);
    const wrapperFn = (params: TParams): Awaitable<TResult> => mutationFn(params);

    return attachKey(wrapperFn, key) as unknown as MutationFunction<TResult, TParams>;
  }

  /**
   * Fetch a query and return the result.
   */
  public fetchQuery<TQueryFnData = unknown, TData = TQueryFnData, TParams = unknown, TPageParam = never>(
    options: Except<FetchQueryOptions<TQueryFnData, Error, TData, QueryKey<TParams>, TPageParam>, "queryHash" | "queryKeyHashFn">
  ): Promise<TData> {
    return this.#queryClient.fetchQuery(options);
  }

  /**
   * Prefetch a query and store the result in cache.
   */
  public prefetchQuery<TQueryFnData = unknown, TData = TQueryFnData, TParams = unknown, TPageParam = never>(
    options: Except<FetchQueryOptions<TQueryFnData, Error, TData, QueryKey<TParams>, TPageParam>, "queryHash" | "queryKeyHashFn">
  ): Promise<void> {
    return this.#queryClient.prefetchQuery(options);
  }

  /**
   * Execute a mutation imperatively outside of React components.
   *
   * Useful for scenarios like login flows, event handlers, or any code outside React components.
   * Lifecycle callbacks (onMutate, onSuccess, etc.) still fire.
   */
  public executeMutation<TData = unknown, TParams = unknown, TOnMutateResult = unknown>(
    {
      mutationFn,
      params,
      ...options
    }: Except<MutationOptions<TData, Error, TParams, TOnMutateResult>, "mutationKey" | "mutationFn">
      & { mutationFn: MutationFunction<TData, TParams> }
      & If<IsNever<TParams>, { params?: never }, If<IsOptional<TParams>, { params?: TParams }, { params: TParams }>>
  ): Promise<TData> {
    const mutation = this.#queryClient
      .getMutationCache()
      .build(this.#queryClient, {
        mutationKey: [mutationFn.key],
        mutationFn,
        ...options
      });

    return mutation.execute(params as TParams);
  }
}
