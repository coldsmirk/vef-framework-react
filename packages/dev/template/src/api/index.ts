import { createApiClient } from "@vef-framework-react/starter";
import { refreshAuth } from "~apis";
import { getAppConfig } from "~helpers";

export { createApiRequest, type ApiRequest } from "@vef-framework-react/core";

export const API_PATH = "/api";

export const apiClient = createApiClient({
  http: {
    baseUrl: getAppConfig("apiBaseUrl"),
    tokenExpiredCode: 1002,
    okCode: 0,
    timeout: 1000 * 30,
    async refreshToken(tokens) {
      return await apiClient.executeMutation({
        mutationFn: refreshAuth,
        params: tokens
      });
    }
  }
});
