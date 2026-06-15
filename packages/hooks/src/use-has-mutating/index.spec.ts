import type { ApiClient, HttpClient } from "@vef-framework-react/core";

import { useMutation } from "@vef-framework-react/core";
import { afterEach, describe, expect, it } from "vitest";

import { act, createTestApiClient, renderHook, waitFor } from "../../test-utils";
import { useHasMutating } from "./index";

let pendingResolver: ((value: string) => void) | undefined;

function pendingHandler(): Promise<string> {
  return new Promise<string>(resolve => {
    pendingResolver = resolve;
  });
}

function buildPendingMutation(_http: Readonly<HttpClient>): typeof pendingHandler {
  return pendingHandler;
}

describe("hooks/useHasMutating", () => {
  afterEach(() => {
    pendingResolver = undefined;
  });

  it("returns false when no mutations are in flight for the key", () => {
    const apiClient = createTestApiClient();

    const { result } = renderHook(() => useHasMutating("orders/create"), { apiClient });

    expect(result.current).toBe(false);
  });

  it("returns true while a mutation with the matching key is running", async () => {
    const apiClient: ApiClient = createTestApiClient();
    const mutationFn = apiClient.createMutationFn<string>("orders/create", buildPendingMutation);

    const { result } = renderHook(
      () => {
        const mutation = useMutation({ mutationKey: [mutationFn.key], mutationFn });
        return { mutate: () => mutation.mutate(undefined as never), has: useHasMutating("orders/create") };
      },
      { apiClient }
    );

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.has).toBe(true);
    });

    await act(async () => {
      pendingResolver?.("done");
      await Promise.resolve();
    });
  });

  it("ignores mutations with a different key", () => {
    const apiClient = createTestApiClient();

    const { result } = renderHook(() => useHasMutating("orders/create"), { apiClient });

    expect(result.current).toBe(false);
  });
});
