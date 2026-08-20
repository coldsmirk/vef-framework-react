import type { ReactNode } from "react";

import type { SsoLoginProps } from "../components";

import { SsoLogin } from "../components";

/**
 * Single sign-on route wiring that renders the framework's own landing page.
 */
type SsoRouteOptionsWithDefaultPage = SsoLoginProps & {
  component?: never;
};

/**
 * Single sign-on route wiring for a landing page the application supplies.
 */
interface SsoRouteOptionsWithCustomPage {
  /**
   * Replaces the landing page entirely. It renders inside this route, so it can
   * call `useSsoLogin` to drive the exchange itself — which is how single
   * sign-on gets an application-specific screen without reimplementing the
   * one-time exchange or the challenge chain.
   */
  component: () => ReactNode;
}

/**
 * Options for the single sign-on route. Either the framework's landing page is
 * configured, or the application supplies its own — a custom page passes its
 * own options to `useSsoLogin`, so accepting both would leave one set silently
 * dead.
 */
export type SsoRouteOptions = SsoRouteOptionsWithDefaultPage | SsoRouteOptionsWithCustomPage;

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
export function createSsoRouteOptions(options: SsoRouteOptions) {
  return {
    validateSearch: (search: Record<string, unknown>) => search,
    component: resolveSsoComponent(options)
  } as const;
}

function resolveSsoComponent(options: SsoRouteOptions): () => ReactNode {
  if (options.component) {
    return options.component;
  }

  return function SsoComponent() {
    return <SsoLogin {...options} />;
  };
}
