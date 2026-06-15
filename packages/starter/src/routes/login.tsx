import type { LoginProps } from "../components";

import { redirect } from "@tanstack/react-router";
import { z } from "@vef-framework-react/shared";

import { Login } from "../components";
import { INDEX_ROUTE_PATH } from "../constants";
import { useAppStore } from "../stores";

export function createLoginRouteOptions(props: LoginProps) {
  function LoginComponent() {
    return <Login {...props} />;
  }

  return {
    validateSearch: z.object({
      redirect: z.string().optional().default(INDEX_ROUTE_PATH).catch(INDEX_ROUTE_PATH)
    }),
    beforeLoad: ({ search }: { search: { redirect: string } }) => {
      if (useAppStore.getState().isAuthenticated) {
        throw redirect({ to: search.redirect, replace: true });
      }
    },
    component: LoginComponent
  } as const;
}
