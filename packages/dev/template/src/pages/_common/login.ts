import type { LoginParams } from "@vef-framework-react/starter";

import { createFileRoute } from "@tanstack/react-router";
import { createLoginRouteOptions } from "@vef-framework-react/starter";
import { apiClient } from "~api";
import { login } from "~apis";

function handleLogin(params: LoginParams) {
  return apiClient.executeMutation({ mutationFn: login, params });
}

export const Route = createFileRoute("/_common/login")(
  createLoginRouteOptions({
    onLogin: handleLogin
  })
);
