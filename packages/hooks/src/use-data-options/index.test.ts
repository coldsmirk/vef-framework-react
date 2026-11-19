import * as core from "@vef-framework-react/core";

import { act, createTestApiClient, renderHook, waitFor } from "../../test-utils";
import { useDataOptionsQuery } from "./index";

describe("hooks/useDataOptionsQuery", () => {
  afterEach(() => vi.restoreAllMocks());

  it("retries a first-load error on remount and notifies the new observer", async () => {
    const apiClient = createTestApiClient();
    const rows = [{ value: "one", label: "One" }];
    const queryFn = vi.fn<() => Promise<typeof rows>>()
      .mockRejectedValueOnce(new Error("temporarily unavailable"))
      .mockResolvedValueOnce(rows);
    const queryOptions = { queryKey: ["remount"] as const, queryFn };
    const first = vi.fn();
    const second = vi.fn();
    const observer = renderHook(() => useDataOptionsQuery({ queryOptions, onFetch: first }).isError, { apiClient });
    await waitFor(() => expect(observer.result.current).toBe(true));
    observer.unmount();

    const { result } = renderHook(() => useDataOptionsQuery({ queryOptions, onFetch: second }), { apiClient });
    await waitFor(() => expect(second).toHaveBeenCalledExactlyOnceWith(rows));
    expect(result.current.options).toEqual(rows);
    expect(first).not.toHaveBeenCalled();
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("displays placeholder options and notifies only when the request settles", async () => {
    const onFetch = vi.fn();
    const rows = [{ value: "one", label: "One" }];
    const pending = Promise.withResolvers<typeof rows>();
    const { result } = renderHook(() => useDataOptionsQuery({
      queryOptions: {
        queryKey: ["options"],
        queryFn: () => pending.promise,
        placeholderData: rows
      },
      onFetch
    }));

    expect(result.current.options).toEqual(rows);
    expect(onFetch).not.toHaveBeenCalled();
    await act(() => pending.resolve(rows));
    await waitFor(() => expect(onFetch).toHaveBeenCalledExactlyOnceWith(rows));
  });

  it("keeps the previous key's options visible without notifying for them again", async () => {
    const onFetch = vi.fn();
    const first = [{ value: "one", label: "One" }];
    const second = [{ value: "two", label: "Two" }];
    const pending = Promise.withResolvers<typeof second>();
    const { result, rerender } = renderHook(key => useDataOptionsQuery({
      queryOptions: {
        queryKey: [key],
        queryFn: () => key === "first" ? first : pending.promise,
        placeholderData: core.keepPreviousData
      },
      onFetch
    }), { initialProps: "first" });

    await waitFor(() => expect(onFetch).toHaveBeenCalledExactlyOnceWith(first));
    rerender("second");
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.options).toEqual(first);
    expect(onFetch).toHaveBeenCalledTimes(1);
    await act(() => pending.resolve(second));
    await waitFor(() => expect(onFetch).toHaveBeenNthCalledWith(2, second));
    expect(onFetch).toHaveBeenCalledTimes(2);
  });

  it("notifies for each distinct cached key even when both select the same array", () => {
    const apiClient = createTestApiClient();
    const client = apiClient[core.QUERY_CLIENT];
    client.setQueryData(["first"], ["a"]);
    client.setQueryData(["second"], ["b"]);
    const shared: string[] = [];
    const select = () => shared;
    const queryFn = vi.fn(() => ["fresh"]);
    const onFetch = vi.fn();
    const { rerender } = renderHook(key => useDataOptionsQuery({
      queryOptions: {
        queryKey: [key],
        queryFn,
        select,
        staleTime: Infinity
      },
      onFetch
    }), { apiClient, initialProps: "first" });

    expect(onFetch).toHaveBeenCalledExactlyOnceWith(shared);
    rerender("second");
    expect(onFetch).toHaveBeenCalledTimes(2);
    expect(onFetch.mock.calls[1]?.[0]).toBe(shared);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("uses the custom key hash when two keys identify the same cached result", () => {
    const rows = [{ value: "one", label: "One" }];
    const onFetch = vi.fn();
    const { rerender } = renderHook((key: string) => useDataOptionsQuery({
      queryOptions: {
        queryKey: [key],
        queryKeyHashFn: ([name]) => String(name).toLowerCase(),
        queryFn: () => rows,
        initialData: rows,
        staleTime: Infinity
      },
      onFetch
    }), { initialProps: "FIRST" });

    rerender("first");
    expect(onFetch).toHaveBeenCalledExactlyOnceWith(rows);
  });

  it("omits data and forwards a query result getter only when the caller reads it", async () => {
    const rows = [{ value: "one", label: "One" }];
    const queryOptions = {
      queryKey: ["options"] as const,
      queryFn: () => rows,
      enabled: false
    };
    const source = renderHook(() => core.useQuery(queryOptions));
    const settled = await act(() => source.result.current.refetch());
    source.unmount();
    const readPromise = vi.fn(() => Promise.resolve(rows));
    // Supply the getter at the boundary even on TanStack versions that omit it.
    const queryResult = {
      ...settled,
      get promise() {
        return readPromise();
      }
    };
    vi.spyOn(core, "useQuery").mockReturnValue(queryResult);
    const { result } = renderHook(() => useDataOptionsQuery({ queryOptions }));

    expect("data" in result.current).toBe(false);
    expect(result.current.options).toEqual(rows);
    expect(readPromise).not.toHaveBeenCalled();
    expect(Reflect.get(result.current, "promise")).toBeInstanceOf(Promise);
    expect(readPromise).toHaveBeenCalledTimes(1);
  });

  it("exposes a load error and delivers rows after a successful retry", async () => {
    const apiClient = createTestApiClient();
    const onFetch = vi.fn();
    const rows = [{ value: "one", label: "One" }];
    const queryFn = vi.fn<() => Promise<typeof rows>>()
      .mockRejectedValueOnce(new Error("temporarily unavailable"))
      .mockResolvedValueOnce(rows);
    const { result } = renderHook(() => {
      const {
        isError,
        refetch,
        options
      } = useDataOptionsQuery({
        queryOptions: { queryKey: ["options"], queryFn },
        onFetch
      });
      return {
        isError,
        refetch,
        options
      };
    }, { apiClient });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(onFetch).not.toHaveBeenCalled();
    await act(() => result.current.refetch());
    await waitFor(() => expect(onFetch).toHaveBeenCalledExactlyOnceWith(rows));
    expect(result.current.options).toEqual(rows);
  });

  it("ignores a pending response from a previously selected query", async () => {
    const apiClient = createTestApiClient();
    const onFetch = vi.fn();
    const pending = Promise.withResolvers<Array<{ value: string; label: string }>>();
    const current = [{ value: "new", label: "New" }];
    const { rerender } = renderHook(
      id => useDataOptionsQuery({
        queryOptions: { queryKey: ["options", id], queryFn: () => id === "old" ? pending.promise : current },
        onFetch
      }),
      { apiClient, initialProps: "old" }
    );

    expect(onFetch).not.toHaveBeenCalled();
    rerender("new");
    await waitFor(() => expect(onFetch).toHaveBeenCalledExactlyOnceWith(current));
    await act(() => {
      pending.resolve([{ value: "old", label: "Old" }]);
      return pending.promise;
    });
    expect(onFetch).toHaveBeenCalledTimes(1);
  });

  it("delivers changed data to the latest callback and skips unchanged data", async () => {
    const apiClient = createTestApiClient();
    const first = vi.fn();
    const latest = vi.fn();
    const rows = [{ value: "one", label: "One" }];
    const next = [{ value: "two", label: "Two" }];
    const queryFn = vi.fn<() => Promise<typeof rows>>()
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([...rows])
      .mockResolvedValueOnce(next);
    const { result, rerender } = renderHook(
      onFetch => useDataOptionsQuery({ queryOptions: { queryKey: ["options"], queryFn }, onFetch }),
      { apiClient, initialProps: first }
    );

    await waitFor(() => expect(first).toHaveBeenCalledExactlyOnceWith(rows));
    rerender(latest);
    await act(() => result.current.refetch());
    expect(latest).not.toHaveBeenCalled();

    await act(() => result.current.refetch());
    await waitFor(() => expect(latest).toHaveBeenCalledExactlyOnceWith(next));
    expect(first).toHaveBeenCalledTimes(1);
  });
});
