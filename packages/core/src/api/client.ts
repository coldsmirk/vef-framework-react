import type { FetchQueryOptions, MutationOptions, QueryClient, QueryFunctionContext, QueryMeta } from "@tanstack/react-query";
import type { Awaitable, Except, If, IsNever, IsOptional } from "@vef-framework-react/shared";
import type { GenericAbortSignal } from "axios";

import type { HttpClient, RequestOptions } from "../http";
import type { ApiClientOptions, MutationFunction, QueryFunction, QueryKey } from "./types";

import { isFunction } from "@vef-framework-react/shared";

import { createHttpClient } from "../http";
import { createQueryClient } from "../query";
import { HTTP_CLIENT, PROXIED_METHODS, QUERY_CLIENT } from "./constants";

interface ObservableAbortSignal extends GenericAbortSignal {
  addEventListener: NonNullable<GenericAbortSignal["addEventListener"]>;
  removeEventListener: NonNullable<GenericAbortSignal["removeEventListener"]>;
}

interface CombinedAbortSignalHandle {
  signal: AbortSignal;
  dispose: () => void;
}

function isObservableAbortSignal(signal: GenericAbortSignal): signal is ObservableAbortSignal {
  return typeof signal.addEventListener === "function" && typeof signal.removeEventListener === "function";
}

/**
 * Combine query cancellation with a request's explicit cancellation signal.
 */
function combineAbortSignals(
  querySignal: AbortSignal,
  requestSignal?: GenericAbortSignal
): CombinedAbortSignalHandle {
  if (!requestSignal || requestSignal === querySignal) {
    return {
      signal: querySignal,
      dispose: () => undefined
    };
  }

  const explicitSignal = requestSignal;
  const controller = new AbortController();
  const observableRequestSignal = isObservableAbortSignal(explicitSignal) ? explicitSignal : undefined;
  let disposed = false;

  function dispose(): void {
    if (disposed) {
      return;
    }

    querySignal.removeEventListener("abort", abort);
    observableRequestSignal?.removeEventListener("abort", abort);
    disposed = true;
  }

  function abort(): void {
    if (!controller.signal.aborted) {
      controller.abort();
    }

    dispose();
  }

  if (querySignal.aborted || explicitSignal.aborted) {
    controller.abort();
  } else {
    querySignal.addEventListener("abort", abort, { once: true });
    observableRequestSignal?.addEventListener("abort", abort, { once: true });

    // Close the gap between the pre-check and listener registration.
    if (querySignal.aborted || explicitSignal.aborted) {
      abort();
    }
  }

  return {
    signal: controller.signal,
    dispose
  };
}

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

  constructor(options: ApiClientOptions) {
    const { http, query } = options;

    this.#queryClient = createQueryClient(query);
    this.#httpClient = this.createProxiedHttpClient(createHttpClient(http));
  }

  /**
   * Create a proxied HttpClient whose methods stay bound to the original
   * instance. Query-scoped proxies also inject their invocation's abort
   * signal into request methods.
   */
  private createProxiedHttpClient(
    httpClient: Readonly<HttpClient>,
    signal?: AbortSignal
  ): Readonly<HttpClient> {
    const proxyCache = new Map<string | symbol, Function>();

    return new Proxy(httpClient, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);

        if (!isFunction(value)) {
          return value;
        }

        if (!proxyCache.has(prop)) {
          const handler = PROXIED_METHODS.has(prop as string) && signal !== undefined
            ? async (url: string, options?: RequestOptions) => {
              const combinedSignal = combineAbortSignals(signal, options?.signal);

              try {
                return await value.apply(target, [
                  url,
                  { ...options, signal: combinedSignal.signal }
                ]);
              } finally {
                combinedSignal.dispose();
              }
            }
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
   *
   * The factory runs once per query execution so each handler receives an
   * invocation-scoped HttpClient. Factories must be side-effect-free, must
   * not retain state across executions, and cannot perform one-time setup.
   */
  public createQueryFn<TResult = unknown, TParams = never, TPageParam = never>(
    key: string,
    factory: (http: Readonly<HttpClient>) => (queryParams: TParams, pageParam: TPageParam, meta?: QueryMeta) => Awaitable<TResult>
  ): QueryFunction<TResult, TParams, TPageParam> {
    const wrapperFn = (context: QueryFunctionContext<QueryKey<TParams>, TPageParam>): Awaitable<TResult> => {
      const {
        queryKey,
        signal,
        pageParam,
        meta
      } = context;
      const [, params] = queryKey;
      // The handler must close over this invocation's client so async and
      // concurrent queries cannot share mutable signal state.
      const httpClient = this.createProxiedHttpClient(this.#httpClient, signal);
      const queryFn = factory(httpClient);
      return queryFn(params as TParams, pageParam as TPageParam, meta);
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
