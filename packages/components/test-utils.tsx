import type { RenderHookOptions, RenderHookResult, RenderOptions } from "@testing-library/react";
import type { ApiClient, AppContext, HttpClientOptions } from "@vef-framework-react/core";
import type { PropsWithChildren, ReactElement, ReactNode } from "react";

import type { ConfigProviderProps } from "./src";

import { renderHook as originalRenderHook, render } from "@testing-library/react";
import { ApiClientProvider, AppContextProvider, createApiClient } from "@vef-framework-react/core";

import { ConfigProvider } from "./src";

interface ProviderOverrides {
  /**
   * Props forwarded to the `ConfigProvider` wrapper. Omit unless the test
   * needs to customize theme, locale, or other antd-level config.
   */
  configProviderProps?: ConfigProviderProps;
  /**
   * `AppContext` value for permission-aware components and hooks. Defaults to
   * an empty object (no permissions, no user).
   */
  appContext?: AppContext;
  /**
   * `ApiClient` instance exposed via `ApiClientProvider` (which also installs
   * `QueryClientProvider` internally). When omitted, an isolated client is
   * created automatically via `createTestApiClient()` so any code path that
   * touches `useApiClient`, `useMutation`, or `useQuery` resolves cleanly.
   *
   * Pass an explicit instance when the test needs:
   * - a specific `baseUrl` or auth callback,
   * - shared cache continuity across multiple renders, or
   * - to spy on the underlying `HttpClient` (via `vi.spyOn(HttpClient.prototype, ...)`).
   */
  apiClient?: ApiClient;
}

export interface CustomRenderOptions extends Omit<RenderOptions, "wrapper">, ProviderOverrides {}

export interface CustomRenderHookOptions<TProps> extends RenderHookOptions<TProps>, ProviderOverrides {}

/**
 * Build a fresh `ApiClient` suitable for tests. The default `baseUrl` is a
 * non-routable host (`https://vef-test.invalid`) so accidental real network
 * calls fail fast and obviously.
 *
 * Each call returns an independent client — share an instance explicitly when
 * cache continuity is part of what's being tested.
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

function wrapWithProviders(
  children: ReactNode,
  overrides: ProviderOverrides
): ReactNode {
  const appContext = overrides.appContext ?? EMPTY_APP_CONTEXT;
  const apiClient = overrides.apiClient ?? createTestApiClient();

  return (
    <AppContextProvider value={appContext}>
      <ApiClientProvider value={apiClient}>
        <ConfigProvider {...overrides.configProviderProps}>
          {children}
        </ConfigProvider>
      </ApiClientProvider>
    </AppContextProvider>
  );
}

function customRender(ui: ReactElement, options?: CustomRenderOptions) {
  const {
    configProviderProps,
    appContext,
    apiClient,
    ...renderOptions
  } = options ?? {};

  function Wrapper({ children }: PropsWithChildren) {
    return wrapWithProviders(children, {
      configProviderProps,
      appContext,
      apiClient
    });
  }

  return render(ui, {
    wrapper: Wrapper,
    ...renderOptions
  });
}

function customRenderHook<TProps, TResult>(
  callback: (props: TProps) => TResult,
  options?: CustomRenderHookOptions<TProps>
): RenderHookResult<TResult, TProps> {
  const {
    configProviderProps,
    appContext,
    apiClient,
    wrapper: OuterWrapper,
    ...restOptions
  } = options ?? {};

  function Wrapper({ children }: PropsWithChildren) {
    const wrapped = wrapWithProviders(children, {
      configProviderProps,
      appContext,
      apiClient
    });

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
export { customRender as render, customRenderHook as renderHook };
