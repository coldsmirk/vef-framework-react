import { createTestApiClient, renderHook, waitFor } from "../../../test-utils";
import { useDataOptionsTree } from "./use-data-options-tree";

describe("useDataOptionsTree onFetch", () => {
  it("delivers an empty result", async () => {
    const onFetch = vi.fn();
    const apiClient = createTestApiClient();
    renderHook(() => useDataOptionsTree({
      queryOptions: { queryKey: ["empty"], queryFn: () => [] },
      onFetch
    }), { apiClient });

    await waitFor(() => expect(onFetch).toHaveBeenCalledExactlyOnceWith([]));
  });

  it("delivers the selected rows before option normalization", async () => {
    const onFetch = vi.fn();
    const apiClient = createTestApiClient();
    renderHook(() => useDataOptionsTree({
      queryOptions: {
        queryKey: ["people"],
        queryFn: () => [{ id: "ada", name: "Ada" }],
        select: rows => rows.map(({ id, name }) => { return { id, display: name.toUpperCase() }; })
      },
      labelKey: "display",
      valueKey: "id",
      onFetch
    }), { apiClient });

    await waitFor(() => expect(onFetch).toHaveBeenCalledExactlyOnceWith([{ id: "ada", display: "ADA" }]));
  });

  it("delivers fresh cached rows to a remounted observer", async () => {
    const apiClient = createTestApiClient();
    const rows = [{ label: "Ada", value: "ada" }];
    const queryFn = vi.fn(() => rows);
    const queryOptions = {
      queryKey: ["cached"] as const,
      queryFn,
      staleTime: Infinity
    };
    const first = vi.fn();
    const second = vi.fn();

    const { unmount } = renderHook(() => useDataOptionsTree({ queryOptions, onFetch: first }), { apiClient });
    await waitFor(() => expect(first).toHaveBeenCalledExactlyOnceWith(rows));
    unmount();
    renderHook(() => useDataOptionsTree({ queryOptions, onFetch: second }), { apiClient });

    expect(second).toHaveBeenCalledExactlyOnceWith(rows);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
