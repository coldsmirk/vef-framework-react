import type { ReactNode } from "react";

import type { SsoLoginProps } from "../components";

import { SsoLogin } from "../components";

export interface SsoRouteOptions extends SsoLoginProps {
  /**
   * Replaces the landing page entirely. It renders inside this route, so it can
   * call `useSsoLogin` to drive the exchange itself — which is the supported
   * way to give single sign-on an application-specific screen without
   * reimplementing the one-time exchange or the challenge chain.
   *
   * The remaining options are ignored when it is given: a custom page passes
   * its own to `useSsoLogin`.
   */
  component?: () => ReactNode;
}

/**
 * Route options for the single sign-on landing page — where a trust-login
 * gateway redirects the browser after it verifies a handoff.
 *
 * Unlike `createLoginRouteOptions` there is deliberately no `beforeLoad` that
 * bounces an already-authenticated visitor to their target. A handoff names the
 * user it is for, and it may well arrive at a tab already signed in as somebody
 * else; short-circuiting on the existing session would silently keep the wrong
 * identity. The exchange runs regardless and replaces whatever session was
 * there.
 *
 * The search parameters are passed through unvalidated because they are the
 * originating system's contract, not this application's — `readHandoff` is
 * where they are interpreted.
 */
export function createSsoRouteOptions({ component, ...props }: SsoRouteOptions) {
  function SsoComponent() {
    return <SsoLogin {...props} />;
  }

  return {
    validateSearch: (search: Record<string, unknown>) => search,
    component: component ?? SsoComponent
  } as const;
}
