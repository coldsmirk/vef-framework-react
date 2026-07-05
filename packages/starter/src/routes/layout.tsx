import type { ParsedLocation, RouteLoaderFn, RouteOptions } from "@tanstack/react-router";
import type { DynamicIconName, MenuItem } from "@vef-framework-react/components";
import type { AnyObject, Awaitable, EmptyObject, Except } from "@vef-framework-react/shared";

import type { LayoutProps } from "../components";
import type { RouterContext, UserInfo, UserMenu } from "../types";

import { Outlet, redirect } from "@tanstack/react-router";
import { DynamicIcon, Loader } from "@vef-framework-react/components";

import { Error, Layout, NotFound } from "../components";
import { ACCESS_DENIED_ROUTE_PATH, LOGIN_ROUTE_PATH } from "../constants";
import { menuKeyOf } from "../helpers/menu-key";
import { useAppStore } from "../stores";

type BaseLayoutBeforeLoadArgs = Parameters<NonNullable<RouteOptions<unknown, any, any>["beforeLoad"]>>[0];

export type LayoutBeforeLoadArgs
  = Except<BaseLayoutBeforeLoadArgs, "context"> & {
    context: RouterContext & BaseLayoutBeforeLoadArgs["context"];
  };

type BaseLayoutLoaderArgs = Parameters<RouteLoaderFn<unknown, any, any>>[0];

export type LayoutLoaderArgs<TBeforeLoadContext extends AnyObject = EmptyObject>
  = Except<BaseLayoutLoaderArgs, "context"> & {
    context: RouterContext & BaseLayoutLoaderArgs["context"] & TBeforeLoadContext;
  };

interface LayoutRouteOptions<
  TBeforeLoadContext extends AnyObject = EmptyObject,
  TLoaderData = void
> extends Except<LayoutProps, "children"> {
  fetchUserInfo: () => Awaitable<UserInfo>;
  beforeLoad?: (args: LayoutBeforeLoadArgs) => Awaitable<TBeforeLoadContext | void>;
  loader?: (args: LayoutLoaderArgs<TBeforeLoadContext>) => Awaitable<TLoaderData>;
}

function buildUserMenuMap(menus: UserMenu[], menuMap = new Map<string, Readonly<UserMenu>>()): Map<string, Readonly<UserMenu>> {
  for (const menu of menus) {
    if (menu.children) {
      buildUserMenuMap(menu.children, menuMap);
    }

    menuMap.set(menuKeyOf(menu.path, menu.meta), menu);
  }

  return menuMap;
}

function buildMenuPathMap(
  menus: UserMenu[],
  parentChain: string[] = [],
  menuPathMap = new Map<string, readonly string[]>()
): Map<string, readonly string[]> {
  for (const menu of menus) {
    const currentChain = [...parentChain, menuKeyOf(menu.path, menu.meta)];
    menuPathMap.set(menuKeyOf(menu.path, menu.meta), currentChain);

    if (menu.children) {
      buildMenuPathMap(menu.children, currentChain, menuPathMap);
    }
  }

  return menuPathMap;
}

/**
 * Collect the distinct route templates the menus cover. The route access check
 * is per-template (any `/report/<key>` is allowed when a `/report/$key` menu
 * exists), so it keys off `path` rather than the per-entry composite menu key.
 */
function buildMenuPathSet(menus: UserMenu[], pathSet = new Set<string>()): Set<string> {
  for (const menu of menus) {
    pathSet.add(menu.path);

    if (menu.children) {
      buildMenuPathSet(menu.children, pathSet);
    }
  }

  return pathSet;
}

function buildMenuItem(menu: UserMenu): MenuItem {
  const {
    path,
    type,
    name,
    icon
  } = menu;

  const iconElement = icon ? <DynamicIcon name={icon as DynamicIconName} /> : undefined;

  if (type === "directory") {
    return {
      type: "submenu",
      key: menuKeyOf(path, menu.meta),
      label: name,
      icon: iconElement,
      children: menu.children ? buildMenuItems(menu.children) : []
    };
  }

  return {
    type: "item",
    key: menuKeyOf(path, menu.meta),
    label: name,
    icon: iconElement
  };
}

function buildMenuItems(menus: UserMenu[]): MenuItem[] {
  return menus
    .filter(menu => menu.type !== "view")
    .map(menu => Object.freeze(buildMenuItem(menu)));
}

/**
 * Resolve the menu key for the current location.
 *
 * Menus are keyed by their route template (`/report/$key`), but
 * `location.pathname` is the instantiated path (`/report/test123`). Matching
 * the location against the route tree yields the leaf route's `fullPath`
 * (the template), so a parameterized route resolves to the menu that owns it
 * instead of failing the access check against a path the menu can never hold.
 * Mirrors the `fullPath` lookup used for tab tracking in `createRouter`.
 */
function resolveMenuKey(context: RouterContext, location: ParsedLocation): string {
  const { router } = context;
  const match = router
    .matchRoutes(location.pathname, location.search, { preload: false, throwOnError: false })
    .at(-1)!;

  return match.fullPath;
}

export function createLayoutRouteOptions<
  TBeforeLoadContext extends AnyObject = EmptyObject,
  TLoaderData = void
>({
  fetchUserInfo,
  beforeLoad,
  loader,
  ...layoutProps
}: LayoutRouteOptions<TBeforeLoadContext, TLoaderData>) {
  function LayoutComponent() {
    return (
      <Layout {...layoutProps}>
        <Outlet />
      </Layout>
    );
  }

  return {
    // The wrapper handlers declare their parameter as `unknown` on purpose. TanStack's
    // beforeLoad/loader option constraints reference the global Register in their parameter
    // types; once an app registers a fully-typed router (Register.router carries the concrete
    // routeTree), checking a pre-built handler's precise parameter type against that constraint
    // forces TS to resolve `typeof router` → routeTree → the very Route being inferred — TS7022.
    // `unknown` is the top type, so the contravariant parameter check passes without expanding
    // the constraint; the single cast below re-narrows for the body and the user-facing
    // `LayoutBeforeLoadArgs` / `LayoutLoaderArgs` callback types stay precise.
    beforeLoad: async (rawArgs: unknown): Promise<TBeforeLoadContext> => {
      const args = rawArgs as LayoutBeforeLoadArgs;
      const { location, context } = args;
      const { isAuthenticated, menuPathSet } = useAppStore.getState();

      if (!isAuthenticated) {
        throw redirect({ to: LOGIN_ROUTE_PATH, search: { redirect: location.href } });
      }

      if (menuPathSet && !menuPathSet.has(resolveMenuKey(context, location))) {
        throw redirect({ to: ACCESS_DENIED_ROUTE_PATH, replace: true });
      }

      const beforeLoadContext = await beforeLoad?.(args);

      return beforeLoadContext ?? ({} as TBeforeLoadContext);
    },
    loader: async (rawArgs: unknown): Promise<TLoaderData | undefined> => {
      const args = rawArgs as LayoutLoaderArgs<TBeforeLoadContext>;
      const { location, context } = args;
      const { permissionTokens, ...userInfo } = await fetchUserInfo();
      const { menus } = userInfo;

      const userMenuMap = Object.freeze(buildUserMenuMap(menus));
      const menuPathMap = Object.freeze(buildMenuPathMap(menus));
      const menuPathSet = Object.freeze(buildMenuPathSet(menus));
      const menuItems = Object.freeze(buildMenuItems(menus));

      useAppStore.setState({
        ...useAppStore.getState(),
        userInfo: Object.freeze(userInfo),
        userMenuMap,
        menuPathMap,
        menuPathSet,
        menuItems,
        permissionTokens: Object.freeze(new Set(permissionTokens))
      });

      if (!menuPathSet.has(resolveMenuKey(context, location))) {
        throw redirect({ to: ACCESS_DENIED_ROUTE_PATH, replace: true });
      }

      if (loader) {
        return await loader(args);
      }

      return undefined;
    },
    pendingComponent: () => <Loader description="页面玩命加载中, 请稍后..." descriptionSize={18} size={48} />,
    errorComponent: Error,
    notFoundComponent: NotFound,
    component: LayoutComponent,
    staleTime: Infinity,
    shouldReload: false
  };
}
