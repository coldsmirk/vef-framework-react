import type { ReactNode } from "react";

import type { LoginProps } from "../components";

import { redirect } from "@tanstack/react-router";
import { z } from "@vef-framework-react/shared";

import { Login } from "../components";
import { INDEX_ROUTE_PATH } from "../constants";
import { useAppStore } from "../stores";

/**
 * Login route wiring that renders the framework's own page.
 */
type LoginRouteOptionsWithDefaultPage = LoginProps & {
  component?: never;
};

/**
 * Login route wiring for a page the application supplies itself.
 *
 * Every prop of the default page is explicitly forbidden rather than merely
 * absent. Excess-property checking would catch a fresh object literal on its
 * own, but not a pre-built value — and there the surplus props are dropped in
 * silence, which is the failure mode this union exists to prevent.
 */
type LoginRouteOptionsWithCustomPage = Partial<Record<keyof LoginProps, never>> & {
  /**
   * Replaces the login page entirely. It renders inside this route, so it can
   * call `useLoginFlow` to drive authentication — which is how an application
   * gives login its own screen while keeping the redirect contract and the
   * already-authenticated guard that live on the route rather than in the page.
   */
  component: () => ReactNode;
};

/**
 * Options for the login route. Either the framework's page is configured, or
 * the application supplies its own — a custom page wires `useLoginFlow` itself,
 * so passing it alongside the default page's props would leave those props
 * silently dead.
 */
export type LoginRouteOptions = LoginRouteOptionsWithDefaultPage | LoginRouteOptionsWithCustomPage;

/**
 * Route options for the login page.
 *
 * The route owns two things no login screen should have to restate: the
 * `redirect` contract — where to return after authenticating, defaulted and
 * `catch`-guarded so a malformed value cannot break the route — and the guard
 * that sends an already-authenticated visitor straight there instead of showing
 * them a login form.
 */
export function createLoginRouteOptions(options: LoginRouteOptions) {
  return {
    validateSearch: z.object({
      redirect: z.string().optional().default(INDEX_ROUTE_PATH).catch(INDEX_ROUTE_PATH)
    }),
    beforeLoad: ({ search }: { search: { redirect: string } }) => {
      if (useAppStore.getState().isAuthenticated) {
        throw redirect({ to: search.redirect, replace: true });
      }
    },
    component: resolveLoginComponent(options)
  } as const;
}

function resolveLoginComponent(options: LoginRouteOptions): () => ReactNode {
  if (options.component) {
    return options.component;
  }

  return function LoginComponent() {
    return <Login {...options} />;
  };
}
