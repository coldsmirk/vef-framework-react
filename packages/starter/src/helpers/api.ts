import type { HttpClientOptions, QueryClientOptions } from "@vef-framework-react/core";

import { showErrorMessage, showInfoMessage, showSuccessMessage, showWarningMessage } from "@vef-framework-react/components";
import { createApiClient as createApiClientInternal } from "@vef-framework-react/core";

import { useAppStore } from "../stores";
import { emitAccessDenied, emitUnauthenticated } from "./event";

export interface ApiClientOptions {
  http: Pick<HttpClientOptions, "baseUrl" | "timeout" | "okCode" | "tokenExpiredCode" | "refreshToken">;
  query?: Pick<QueryClientOptions, "gcTime" | "staleTime">;
}

export function createApiClient({ http, query }: ApiClientOptions) {
  return createApiClientInternal({
    http: {
      ...http,
      getAuthTokens: () => useAppStore.getState().authTokens,
      setAuthTokens: tokens => {
        useAppStore.setState(state => {
          state.authTokens = tokens;
        });
      },
      onUnauthenticated: emitUnauthenticated,
      onAccessDenied: emitAccessDenied,
      showInfoMessage,
      showWarningMessage,
      showErrorMessage
    },
    query: {
      ...query,
      showSuccessMessage
    }
  });
}
