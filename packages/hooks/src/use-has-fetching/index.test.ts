import type { HttpClient } from "@vef-framework-react/core";

import { useQuery } from "@vef-framework-react/core";
import { afterEach, describe, expect, it } from "vitest";

import { act, createTestApiClient, renderHook, waitFor } from "../../test-utils";
import { useHasFetching } from "./index";

let pendingResolver: ((value: string) => void) | undefined;

function pendingHandler(): Promise<string> {
  const { promise, resolve } = Promise.withResolvers<string>();

  pendingResolver = resolve;
  return promise;
}

function buildPendingQuery(_http: Readonly<HttpClient>): typeof pendingHandler {
  return pendingHandler;
}

function okHandler(): Promise<string> {
  return Promise.resolve("ok");
}

function buildOkHandler(_http: Readonly<HttpClient>): typeof okHandler {
  return okHandler;
}

describe("hooks/useHasFetching", () => {
  afterEach(() => {
    pendingResolver = undefined;
  });

  it("returns false when there are no active fetches for the key", () => {
    const apiClient = createTestApiClient();

    const { result } = renderHook(() => useHasFetching("orders/list"), { apiClient });

    expect(result.current).toBe(false);
  });

  it("returns true while a query observer with the matching key is fetching", async () => {
    const apiClient = createTestApiClient();
    const queryFn = apiClient.createQueryFn<string>("orders/list", buildPendingQuery);

    const { result } = renderHook(
      () => {
        useQuery({ queryFn, queryKey: [queryFn.key] as const });
        return useHasFetching("orders/list");
      },
      { apiClient }
    );

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    await act(async () => {
      pendingResolver?.("done");
      await Promise.resolve();
    });
  });

  it("ignores active queries with a different key", async () => {
    const apiClient = createTestApiClient();
    const queryFn = apiClient.createQueryFn<string>("invoices/list", buildOkHandler);

    const { result } = renderHook(
      () => {
        useQuery({ queryFn, queryKey: [queryFn.key] as const });
        return useHasFetching("orders/list");
      },
      { apiClient }
    );

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
