import type { AnyRouter } from "@tanstack/react-router";

import { LOGIN_ROUTE_PATH } from "../constants";
import { useAppStore } from "../stores";

export async function handleClientLogout(router: AnyRouter): Promise<void> {
  useAppStore.setState({
    isAuthenticated: false,
    authTokens: undefined,
    userInfo: undefined,
    userMenuMap: undefined,
    menuPathMap: undefined,
    menuItems: undefined,
    permissionTokens: undefined
  });

  await router.navigate({ to: LOGIN_ROUTE_PATH });
  router.invalidate({ sync: true, forcePending: true });
}
