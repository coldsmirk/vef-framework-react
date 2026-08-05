import type { ResolvedFile } from "@vef-framework-react/core";

import {
  resolveFiles,
  STORAGE_API_PATH,
  STORAGE_FILE_RESOURCE,
  STORAGE_VERSION,
  useApiClient,
  useQuery
} from "@vef-framework-react/core";
import { useMemo } from "react";

/**
 * Resolve stored object keys into the metadata the backend recorded when
 * they were uploaded.
 *
 * A business model persists only the storage key
 * (`priv/2026/08/04/<uuid>.pdf`), so anything rendering that value can
 * otherwise show nothing but a generated name. The framework records the
 * original filename, size, and MIME type at upload time; this hook reads
 * them back.
 *
 * Resolution is decoration, never a gate: keys the caller may not read
 * and keys the backend has no record of are simply absent from the
 * result, and a failed request yields an empty map. Callers must fall
 * back to whatever they can derive from the key itself.
 *
 * Results are cached indefinitely — a file's recorded name never changes.
 */
export function useStoredFileNames(keys: readonly string[]): Record<string, ResolvedFile> {
  const apiClient = useApiClient();

  // Sorted and deduplicated so callers re-rendering with a fresh array,
  // or with the same keys in a different order, hit one cache entry.
  const uniqueKeys = useMemo(
    () => [...new Set(keys.filter(Boolean))].toSorted(),
    [keys]
  );

  const queryFn = useMemo(
    () => apiClient.createQueryFn<ResolvedFile[], string[]>(
      "storage_resolve_files",
      http => async requestedKeys => {
        const { files } = await resolveFiles(
          {
            http,
            apiPath: STORAGE_API_PATH,
            resource: STORAGE_FILE_RESOURCE,
            version: STORAGE_VERSION
          },
          requestedKeys
        );

        return files;
      }
    ),
    [apiClient]
  );

  const { data } = useQuery({
    queryFn,
    queryKey: [queryFn.key, uniqueKeys],
    enabled: uniqueKeys.length > 0,
    staleTime: Infinity
  });

  return useMemo(
    () => Object.fromEntries((data ?? []).map(file => [file.key, file])),
    [data]
  );
}
