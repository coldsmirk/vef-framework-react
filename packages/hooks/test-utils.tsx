import type { RenderHookOptions, RenderHookResult } from "@testing-library/react";
import type { ApiClient, AppContext, HttpClientOptions } from "@vef-framework-react/core";
import type { PropsWithChildren } from "react";

import { renderHook as originalRenderHook } from "@testing-library/react";
import { ApiClientProvider, AppContextProvider, createApiClient } from "@vef-framework-react/core";

interface ProviderOverrides {
  /**
   * `AppContext` value to expose via `AppContextProvider`. Defaults to an
   * empty object so permission-aware hooks resolve to "no permissions".
   */
  appContext?: AppContext;
  /**
   * `ApiClient` exposed via `ApiClientProvider` (which also installs
   * `QueryClientProvider`). When omitted, an isolated client is created
   * automatically via `createTestApiClient()` so any hook that calls
   * `useApiClient`, `useMutation`, or `useQuery` resolves cleanly.
   */
  apiClient?: ApiClient;
}

export interface CustomRenderHookOptions<TProps> extends RenderHookOptions<TProps>, ProviderOverrides {}

/**
 * Build a fresh `ApiClient` suitable for tests. The default `baseUrl` is a
 * non-routable host so accidental real network calls fail fast.
 */
export function createTestApiClient(http?: Partial<HttpClientOptions>): ApiClient {
  return createApiClient({
    http: {
      // eslint-disable-next-line unicorn/prefer-https -- non-routable test host; plain HTTP avoids needless TLS setup in tests
      baseUrl: "http://vef-test.invalid",
      ...http
    }
  });
}

const EMPTY_APP_CONTEXT: AppContext = {};

export function renderHook<TProps, TResult>(
  callback: (props: TProps) => TResult,
  options?: CustomRenderHookOptions<TProps>
): RenderHookResult<TResult, TProps> {
  const {
    appContext = EMPTY_APP_CONTEXT,
    apiClient,
    wrapper: OuterWrapper,
    ...restOptions
  } = options ?? {};

  const client = apiClient ?? createTestApiClient();

  function Wrapper({ children }: PropsWithChildren) {
    const wrapped = (
      <AppContextProvider value={appContext}>
        <ApiClientProvider value={client}>
          {children}
        </ApiClientProvider>
      </AppContextProvider>
    );

    if (OuterWrapper) {
      return <OuterWrapper>{wrapped}</OuterWrapper>;
    }

    return wrapped;
  }

  return originalRenderHook(callback, {
    wrapper: Wrapper,
    ...restOptions
  });
}

export * from "@testing-library/react";
