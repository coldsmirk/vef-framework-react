import type { QueryClient, QueryFunctionContext } from "@tanstack/react-query";

import type { HttpClient as IHttpClient } from "../http";

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

function getInsideQueryFactory(http: Readonly<IHttpClient>) {
  return async function getInsideQuery() {
    await http.get("/inside", {});
  };
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

    it("clears the active signal after the queryFn returns", async () => {
      const getSpy = vi.spyOn(HttpClient.prototype, "get").mockResolvedValue({
        code: 0,
        message: "ok",
        data: null
      });
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn("test/cleanup", getInsideQueryFactory);

      const controller = new AbortController();
      await queryFn(buildContext(["test/cleanup"], controller.signal, client[QUERY_CLIENT]));

      await client[HTTP_CLIENT].get("/outside", {});

      expect(getSpy).toHaveBeenLastCalledWith("/outside", expect.objectContaining({
        signal: undefined
      }));
    });

    it("clears the signal even if the queryFn throws synchronously", async () => {
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

      await client[HTTP_CLIENT].get("/after-throw", {});

      expect(getSpy).toHaveBeenLastCalledWith("/after-throw", expect.objectContaining({
        signal: undefined
      }));
    });

    it("clears the signal when the queryFn returns a rejected promise", async () => {
      const getSpy = vi.spyOn(HttpClient.prototype, "get").mockResolvedValue({
        code: 0,
        message: "ok",
        data: null
      });
      const client = new ApiClient({ http: { baseUrl: "http://test" } });
      const queryFn = client.createQueryFn("test/rejects", rejectingQueryFactory);
      const context = buildContext(["test/rejects"] as const, new AbortController().signal, client[QUERY_CLIENT]);

      await expect(queryFn(context)).rejects.toThrow("async-boom");

      await client[HTTP_CLIENT].get("/after-reject", {});

      expect(getSpy).toHaveBeenLastCalledWith("/after-reject", expect.objectContaining({
        signal: undefined
      }));
    });
  });
});
