import type { MaybeNull } from "@vef-framework-react/shared";
import type { JSX, PropsWithChildren } from "react";

import type { ApiClient } from "../api";

import { QueryClientProvider } from "@tanstack/react-query";
import { createContext, use } from "react";

import { QUERY_CLIENT } from "../api";

const ApiClientContext = createContext<MaybeNull<ApiClient>>(null);
ApiClientContext.displayName = "ApiClientContext";

interface ApiClientProviderProps extends PropsWithChildren {
  value: ApiClient;
}

/**
 * Provider for the API client context.
 * Wraps children with both ApiClient context and React Query's QueryClientProvider.
 */
export function ApiClientProvider({ value, children }: ApiClientProviderProps): JSX.Element {
  return (
    <ApiClientContext value={value}>
      <QueryClientProvider client={value[QUERY_CLIENT]}>
        {children}
      </QueryClientProvider>
    </ApiClientContext>
  );
}

/**
 * Hook to access the API client from context.
 *
 * @throws Error if used outside of ApiClientProvider.
 */
export function useApiClient(): ApiClient {
  const apiClient = use(ApiClientContext);

  if (!apiClient) {
    throw new Error("useApiClient must be used within an ApiClientProvider.");
  }

  return apiClient;
}
