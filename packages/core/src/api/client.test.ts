import type { QueryClient, QueryFunctionContext } from "@tanstack/react-query";

import type { HttpClient as IHttpClient, RequestOptions } from "../http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpClient } from "../http";
import { ApiClient } from "./client";
import { HTTP_CLIENT, QUERY_CLIENT } from "./constants";

function buildContext<TQueryKey extends readonly unknown[]>(
  queryKey: TQueryKey,
  signal: AbortSignal,
  queryClient: QueryClient
): QueryFunctionContext<TQueryKey, unknown> {
  return {
    queryKey,
    signal,
    pageParam: undefined,
    meta: undefined,
    client: queryClient
  } as unknown as QueryFunctionContext<TQueryKey, unknown>;
}

// Module-scope query / mutation handlers and their factories. Defined here (not
// inline) to satisfy `unicorn/consistent-function-scoping` and to keep tests focused
// on behavior rather than callback wiring.

function emptyListQuery(): never[] {
  return [];
}

function emptyListQueryFactory(): typeof emptyListQuery {
  return emptyListQuery;
}

function doubleQuery(params: { x: number }): { doubled: number } {
  return { doubled: params.x * 2 };
}

function doubleQueryFactory(): typeof doubleQuery {
  return doubleQuery;
}

function constantQuery(): { value: number } {
  return { value: 100 };
}

function constantQueryFactory(): typeof constantQuery {
  return constantQuery;
}

function echoNameMutation(params: { name: string }): string {
  return params.name;
}

function echoNameMutationFactory(): typeof echoNameMutation {
  return echoNameMutation;
}

function savedIdMutation(params: { id: number }): { savedId: number } {
  return { savedId: params.id };
}

function savedIdMutationFactory(): typeof savedIdMutation {
  return savedIdMutation;
}

function contentMutation(params: { content: string }): { ok: true; content: string } {
  return { ok: true, content: params.content };
}

function contentMutationFactory(): typeof contentMutation {
  return contentMutation;
}

function getDataQueryFactory(http: Readonly<IHttpClient>) {
  return function getDataQuery() {
    return http.get("/data", { params: { id: 1 } });
  };
}

function getAfterAwaitQueryFactory(http: Readonly<IHttpClient>) {
  return async function getAfterAwaitQuery() {
    await Promise.resolve();
    return http.get("/after-await", {});
  };
}

interface DeferredQueryParams {
  path: string;
  ready: Promise<void>;
}

function deferredGetQueryFactory(http: Readonly<IHttpClient>) {
  return async function deferredGetQuery(params: DeferredQueryParams) {
    await params.ready;
    return http.get(params.path, {});
  };
}

interface ExplicitSignalQueryParams {
  signal: AbortSignal;
}

function explicitSignalQueryFactory(http: Readonly<IHttpClient>) {
  return function explicitSignalQuery(params: ExplicitSignalQueryParams) {
    return http.get("/explicit-signal", { signal: params.signal });
  };
}

function rejectGetWhenAborted(_url: string, options?: RequestOptions): Promise<never> {
  const signal = options?.signal;

  if (!signal?.addEventListener) {
    return Promise.reject(new Error("The request did not receive an observable abort signal"));
  }

  return new Promise((_, reject) => {
    function rejectRequest() {
      reject(new Error("request cancelled"));
    }

    if (signal.aborted) {
      rejectRequest();
    } else {
      signal.addEventListener?.("abort", rejectRequest, { once: true });
    }
  });
}

function throwingQuery(): never {
  throw new Error("boom");
}

function throwingQueryFactory(): typeof throwingQuery {
  return throwingQuery;
}

function rejectingQuery(): Promise<never> {
  return Promise.reject(new Error("async-boom"));
}

function rejectingQueryFactory(): typeof rejectingQuery {
  return rejectingQuery;
}

describe("api/ApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("construction", () => {
    it("exposes the QueryClient via the QUERY_CLIENT symbol getter", () => {
      const client = new ApiClient({ http: { baseUrl: "http://test" } });

      const queryClient = client[QUERY_CLIENT];

      expect(queryClient).toBeDefined();
      expect(typeof queryClient.fetchQuery).toBe("function");
    });

    it("exposes a proxied HttpClient via the HTTP_CLIENT symbol getter", () => {
      const client = new ApiClient({ http: { baseUrl: "http://test" } });

      const httpClient = client[HTTP_CLIENT];

      expect(httpClient).toBeDefined();
      expect(typeof httpClient.get).toBe("function");
    });
  });

  describe("createQueryFn", () => {
    it("attaches the provided key as a readonly property on the returned function", () => {
      const client = new ApiClient({ http: { baseUrl: "http://test" } });

      const queryFn = client.createQueryFn("users/list", emptyListQueryFactory);

      expect(queryFn.key).toBe("users/list");

      function reassign() {
        (queryFn as { key: string }).key = "hijacked";
      }

      expect(reassign).toThrow(TypeError);
    });

    it("resolves with whatever the user-supplied queryFn returns", async () => {
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn("test/value", doubleQueryFactory);

      const result = await queryFn(
        buildContext(["test/value", { x: 21 }], new AbortController().signal, client[QUERY_CLIENT])
      );

      expect(result).toEqual({ doubled: 42 });
    });

    it("invokes the factory once per query execution with an isolated HttpClient", async () => {
      const httpClients: Array<Readonly<IHttpClient>> = [];
      const factory = vi.fn((http: Readonly<IHttpClient>) => {
        httpClients.push(http);
        return emptyListQuery;
      });
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn("test/factory", factory);

      await queryFn(buildContext(["test/factory"], new AbortController().signal, client[QUERY_CLIENT]));
      await queryFn(buildContext(["test/factory"], new AbortController().signal, client[QUERY_CLIENT]));

      expect(factory).toHaveBeenCalledTimes(2);
      expect(httpClients).toHaveLength(2);
      expect(httpClients[0]).not.toBe(httpClients[1]);
    });
  });

  describe("createMutationFn", () => {
    it("attaches the provided key as a readonly property", () => {
      const client = new ApiClient({ http: { baseUrl: "http://test" } });

      const mutationFn = client.createMutationFn("users/create", echoNameMutationFactory);

      expect(mutationFn.key).toBe("users/create");
    });

    it("invokes the user mutationFn with the provided params when run via executeMutation", async () => {
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const mutationFn = client.createMutationFn("test/mut", savedIdMutationFactory);

      const result = await client.executeMutation({
        mutationFn,
        params: { id: 7 }
      });

      expect(result).toEqual({ savedId: 7 });
    });
  });

  describe("fetchQuery", () => {
    it("delegates to the QueryClient and resolves with the queryFn's value", async () => {
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn("metrics", constantQueryFactory);

      const result = await client.fetchQuery<{ value: number }, { value: number }, never>({
        queryKey: ["metrics"] as const,
        queryFn
      });

      expect(result).toEqual({ value: 100 });
    });
  });

  describe("executeMutation", () => {
    it("invokes the mutationFn with params and resolves with its return value", async () => {
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const mutationFn = client.createMutationFn("save", contentMutationFactory);

      const result = await client.executeMutation({
        mutationFn,
        params: { content: "hello" }
      });

      expect(result).toEqual({ ok: true, content: "hello" });
    });
  });

  describe("signal injection (proxied methods)", () => {
    it("injects the active signal into proxied HTTP method calls invoked inside a queryFn", async () => {
      const getSpy = vi.spyOn(HttpClient.prototype, "get").mockResolvedValue({
        code: 0,
        message: "ok",
        data: { ok: true }
      });
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn("test/api", getDataQueryFactory);

      const controller = new AbortController();
      await queryFn(buildContext(["test/api"], controller.signal, client[QUERY_CLIENT]));

      expect(getSpy).toHaveBeenCalledWith("/data", expect.objectContaining({
        params: { id: 1 },
        signal: controller.signal
      }));
    });

    it("keeps the query signal after the queryFn awaits", async () => {
      const getSpy = vi.spyOn(HttpClient.prototype, "get").mockResolvedValue({
        code: 0,
        message: "ok",
        data: null
      });
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn("test/after-await", getAfterAwaitQueryFactory);

      const controller = new AbortController();
      await queryFn(buildContext(["test/after-await"], controller.signal, client[QUERY_CLIENT]));

      expect(getSpy).toHaveBeenCalledWith("/after-await", expect.objectContaining({
        signal: controller.signal
      }));
    });

    it("isolates signals between concurrent query invocations", async () => {
      const getSpy = vi.spyOn(HttpClient.prototype, "get").mockResolvedValue({
        code: 0,
        message: "ok",
        data: null
      });
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn<unknown, DeferredQueryParams>("test/concurrent", deferredGetQueryFactory);
      const firstReady = Promise.withResolvers<void>();
      const secondReady = Promise.withResolvers<void>();
      const firstController = new AbortController();
      const secondController = new AbortController();

      const firstRequest = queryFn(buildContext([
        "test/concurrent",
        { path: "/first", ready: firstReady.promise }
      ], firstController.signal, client[QUERY_CLIENT]));
      const secondRequest = queryFn(buildContext([
        "test/concurrent",
        { path: "/second", ready: secondReady.promise }
      ], secondController.signal, client[QUERY_CLIENT]));

      secondReady.resolve();
      await secondRequest;
      firstReady.resolve();
      await firstRequest;

      expect(getSpy).toHaveBeenCalledWith("/first", expect.objectContaining({
        signal: firstController.signal
      }));
      expect(getSpy).toHaveBeenCalledWith("/second", expect.objectContaining({
        signal: secondController.signal
      }));
    });

    it("cancels the request when its explicit signal aborts", async () => {
      vi.spyOn(HttpClient.prototype, "get").mockImplementation(rejectGetWhenAborted);
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn<unknown, ExplicitSignalQueryParams>(
        "test/explicit-abort",
        explicitSignalQueryFactory
      );
      const queryController = new AbortController();
      const requestController = new AbortController();

      const request = queryFn(buildContext([
        "test/explicit-abort",
        { signal: requestController.signal }
      ], queryController.signal, client[QUERY_CLIENT]));

      requestController.abort();

      await expect(request).rejects.toThrow("request cancelled");
      expect(queryController.signal.aborted).toBe(false);
    });

    it("cancels the request when the query signal aborts", async () => {
      vi.spyOn(HttpClient.prototype, "get").mockImplementation(rejectGetWhenAborted);
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn<unknown, ExplicitSignalQueryParams>(
        "test/query-abort",
        explicitSignalQueryFactory
      );
      const queryController = new AbortController();
      const requestController = new AbortController();

      const request = queryFn(buildContext([
        "test/query-abort",
        { signal: requestController.signal }
      ], queryController.signal, client[QUERY_CLIENT]));

      queryController.abort();

      await expect(request).rejects.toThrow("request cancelled");
      expect(requestController.signal.aborted).toBe(false);
    });

    it("removes both source listeners after the request completes", async () => {
      vi.spyOn(HttpClient.prototype, "get").mockResolvedValue({
        code: 0,
        message: "ok",
        data: null
      });
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn<unknown, ExplicitSignalQueryParams>(
        "test/signal-cleanup",
        explicitSignalQueryFactory
      );
      const queryController = new AbortController();
      const requestController = new AbortController();
      const queryRemoveListener = vi.spyOn(queryController.signal, "removeEventListener");
      const requestRemoveListener = vi.spyOn(requestController.signal, "removeEventListener");

      await queryFn(buildContext([
        "test/signal-cleanup",
        { signal: requestController.signal }
      ], queryController.signal, client[QUERY_CLIENT]));

      expect(queryRemoveListener).toHaveBeenCalledWith("abort", expect.any(Function));
      expect(requestRemoveListener).toHaveBeenCalledWith("abort", expect.any(Function));
    });

    it("preserves an explicit signal outside a query", async () => {
      const getSpy = vi.spyOn(HttpClient.prototype, "get").mockResolvedValue({
        code: 0,
        message: "ok",
        data: null
      });
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const controller = new AbortController();

      await client[HTTP_CLIENT].get("/outside", { signal: controller.signal });

      expect(getSpy).toHaveBeenLastCalledWith("/outside", expect.objectContaining({
        signal: controller.signal
      }));
    });

    it("preserves an explicit signal after the queryFn throws synchronously", async () => {
      const getSpy = vi.spyOn(HttpClient.prototype, "get").mockResolvedValue({
        code: 0,
        message: "ok",
        data: null
      });
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn("test/throws", throwingQueryFactory);
      const context = buildContext(["test/throws"] as const, new AbortController().signal, client[QUERY_CLIENT]);

      function invokeQueryFn() {
        return queryFn(context);
      }

      expect(invokeQueryFn).toThrow("boom");

      const controller = new AbortController();
      await client[HTTP_CLIENT].get("/after-throw", { signal: controller.signal });

      expect(getSpy).toHaveBeenLastCalledWith("/after-throw", expect.objectContaining({
        signal: controller.signal
      }));
    });

    it("preserves an explicit signal after the queryFn returns a rejected promise", async () => {
      const getSpy = vi.spyOn(HttpClient.prototype, "get").mockResolvedValue({
        code: 0,
        message: "ok",
        data: null
      });
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn("test/rejects", rejectingQueryFactory);
      const context = buildContext(["test/rejects"] as const, new AbortController().signal, client[QUERY_CLIENT]);

      await expect(queryFn(context)).rejects.toThrow("async-boom");

      const controller = new AbortController();
      await client[HTTP_CLIENT].get("/after-reject", { signal: controller.signal });

      expect(getSpy).toHaveBeenLastCalledWith("/after-reject", expect.objectContaining({
        signal: controller.signal
      }));
    });
  });
});
