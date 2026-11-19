import { act, createTestApiClient, renderHook, waitFor } from "../../test-utils";
import { useDataOptionsQuery } from "./index";

describe("hooks/useDataOptionsQuery", () => {
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
