import type { AuthTokens } from "@vef-framework-react/core";
import type { Except } from "@vef-framework-react/shared";
import type { LoginParams, LoginResult, UserInfo } from "@vef-framework-react/starter";

import { skipAuthenticationHeader, skipAuthenticationValue } from "@vef-framework-react/core";
import { API_PATH, apiClient, createApiRequest } from "~api";

export const login = apiClient.createMutationFn(
  "login",
  ({ post }) => async (params: LoginParams) => {
    const { message, data: loginResult } = await post<Except<LoginResult, "message">>(
      API_PATH,
      { data: createApiRequest("security/auth", "login", params) }
    );
    return { message, ...loginResult };
  }
);

export const logout = apiClient.createMutationFn(
  "logout",
  ({ post }) => () => post(API_PATH, { data: createApiRequest("security/auth", "logout") })
);

export const getUserInfo = apiClient.createQueryFn(
  "get_user_info",
  ({ post }) => async () => {
    const result = await post<UserInfo>(
      API_PATH,
      { data: createApiRequest("security/auth", "get_user_info") }
    );
    return result.data;
  }
);

export const refreshAuth = apiClient.createMutationFn(
  "refresh_auth",
  ({ post }) => async ({ refreshToken }: AuthTokens) => {
    const { data: tokens } = await post<AuthTokens>(
      API_PATH,
      {
        data: createApiRequest("security/auth", "refresh", { refreshToken }),
        headers: { [skipAuthenticationHeader]: skipAuthenticationValue }
      }
    );
    return tokens;
  }
);
