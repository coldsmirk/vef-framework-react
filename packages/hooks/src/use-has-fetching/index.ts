import { useIsFetching as useIsFetchingInternal } from "@vef-framework-react/core";

/**
 * A hook to check if there are any active queries fetching for a specific query key.
 *
 * @param key - The base query key to check for fetching status.
 * @param params - Optional parameters to include in the query key for more specific filtering.
 * @returns True if there are any active queries fetching with the specified key, false otherwise.
 */
export function useHasFetching(key: string, params?: unknown): boolean {
  const count = useIsFetchingInternal({
    queryKey: params ? [key, params] : [key],
    exact: false,
    type: "active"
  });

  return count > 0;
}
