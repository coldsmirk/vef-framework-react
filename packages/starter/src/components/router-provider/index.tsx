import type { AnyRouter, RegisteredRouter, RouterProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { RouterContext, UseRouterContext } from "./context";
import type { RouterProviderProps } from "./props";

import { RouterProvider as TanStackRouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";

import { useRouterContextHook } from "./context";

export function RouterProvider<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>
>({ router }: RouterProviderProps<TRouter, TDehydrated>): ReactNode {
  const contextHook = useRouterContextHook();
  const baseContext = useMemo<RouterContext<TRouter, TDehydrated>>(
    () => ({ router }) as RouterContext<TRouter, TDehydrated>,
    [router]
  );

  if (!contextHook) {
    return <TanStackRouterProvider context={baseContext} router={router} />;
  }

  return (
    <RouterProviderWithContext
      baseContext={baseContext}
      router={router}
      useRouterContext={contextHook as UseRouterContext<TRouter, TDehydrated>}
    />
  );
}

interface RouterProviderWithContextProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>
> extends RouterProviderProps<TRouter, TDehydrated>, Pick<RouterProps<TRouter, TDehydrated>, "context"> {
  baseContext: RouterContext<TRouter, TDehydrated>;
  useRouterContext: UseRouterContext<TRouter, TDehydrated>;
}

function RouterProviderWithContext<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>
>({
  baseContext,
  router,
  useRouterContext
}: RouterProviderWithContextProps<TRouter, TDehydrated>): ReactNode {
  const providedContext = useRouterContext();
  const mergedContext = useMemo<RouterContext<TRouter, TDehydrated>>(
    () => { return { ...providedContext, ...baseContext }; },
    [providedContext, baseContext]
  );

  return <TanStackRouterProvider context={mergedContext} router={router} />;
}

export { RouterContextHookProvider, type RouterContext, type UseRouterContext } from "./context";
export { type RouterProviderProps } from "./props";
