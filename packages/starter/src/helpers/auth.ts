import type { AnyRouter } from "@tanstack/react-router";

import { LOGIN_ROUTE_PATH } from "../constants";
import { useAppStore } from "../stores";

/**
 * The identity-derived slice of the app store. Every field here is loaded for
 * one specific user by the layout route's loader, so all of it has to go
 * whenever the session changes — on logout, and equally on a login that
 * replaces a still-live session, where a surviving `menuPathSet` would decide
 * route access for the incoming user until the loader catches up.
 */
const clearedIdentityState = {
  userInfo: undefined,
  userMenuMap: undefined,
  menuPathMap: undefined,
  menuPathSet: undefined,
  menuItems: undefined,
  permissionTokens: undefined
} as const;

/**
 * Drop the identity loaded for the previous session while leaving
 * authentication state untouched. Called when a new session is established over
 * an existing one, which single sign-on does by construction: the handoff
 * arrives at an app the user may already be signed into as somebody else.
 */
export function clearIdentityState(): void {
  useAppStore.setState(clearedIdentityState);
}

export async function handleClientLogout(router: AnyRouter): Promise<void> {
  useAppStore.setState({
    isAuthenticated: false,
    authTokens: undefined,
    ...clearedIdentityState
  });

  await router.navigate({ to: LOGIN_ROUTE_PATH });
  router.invalidate({ sync: true, forcePending: true });
}
