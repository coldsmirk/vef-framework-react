import type { AnyRouter, RegisteredRouter, RouterProps } from "@tanstack/react-router";
import type { MaybeNull } from "@vef-framework-react/shared";

import { createContext, use } from "react";

export type RouterContext<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>
> = NonNullable<RouterProps<TRouter, TDehydrated>["context"]>;

export type UseRouterContext<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>
> = () => RouterContext<TRouter, TDehydrated>;

const RouterContextHookContext = createContext<MaybeNull<UseRouterContext>>(null);

export function useRouterContextHook(): MaybeNull<UseRouterContext> {
  return use(RouterContextHookContext);
}

export const RouterContextHookProvider = RouterContextHookContext.Provider;
