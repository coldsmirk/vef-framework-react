import type { QueryClientOptions } from "./types";

import { matchQuery, MutationCache, QueryClient } from "@tanstack/react-query";
import { hashKey, isPlainObject } from "@vef-framework-react/shared";

/**
 * Creates a configured QueryClient instance with mutation cache and default options
 */
export function createQueryClient(options?: QueryClientOptions): QueryClient {
  const {
    staleTime = 5000,
    gcTime = 300_000,
    showSuccessMessage
  } = options ?? {};

  const queryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: async (data, _variables, _onMutateResult, mutation) => {
        const { invalidates: queryKeys, shouldShowSuccessFeedback = true } = mutation.meta ?? {};

        if (queryKeys) {
          await queryClient.invalidateQueries({
            stale: false,
            type: "all",
            predicate: query => queryKeys.some(queryKey => matchQuery({ queryKey }, query))
          });
        }

        if (shouldShowSuccessFeedback && isPlainObject(data) && Object.hasOwn(data, "message")) {
          showSuccessMessage?.((data as Record<string, unknown>).message as string);
        }
      }
    }),
    defaultOptions: {
      queries: {
        staleTime,
        gcTime,
        networkMode: "online",
        retry: false,
        structuralSharing: true,
        throwOnError: false,
        refetchOnMount: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        retryOnMount: true,
        queryKeyHashFn: hashKey,

        // TanStack Query exposes this opt-in via the documented mixed-case name;
        // matching the upstream API contract is preferable to renaming it.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        experimental_prefetchInRender: true
      },
      mutations: {
        gcTime,
        networkMode: "online",
        retry: false,
        throwOnError: false
      }
    }
  });

  return queryClient;
}

export { keepPreviousData } from "@tanstack/react-query";
