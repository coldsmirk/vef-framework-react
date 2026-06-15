import { useIsMutating as useIsMutatingInternal } from "@vef-framework-react/core";

/**
 * A hook to check if there are any active mutations for a specific mutation key.
 *
 * @param key - The base mutation key to check for mutating status.
 * @returns True if there are any active mutations with the specified key, false otherwise.
 */
export function useHasMutating(key: string): boolean {
  const count = useIsMutatingInternal({
    mutationKey: [key],
    exact: false
  });

  return count > 0;
}
