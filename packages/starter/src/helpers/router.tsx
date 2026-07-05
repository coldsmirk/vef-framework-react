import type { AnyRouteWithContext } from "@tanstack/react-router";

import type { RouterContext } from "../types";

import { createBrowserHistory, createHashHistory, createRouter as createRouterInternal } from "@tanstack/react-router";
import { Loader, showErrorNotification } from "@vef-framework-react/components";
import { getSanitizedErrorStack, hashKey } from "@vef-framework-react/shared";

import { Error, NotFound, nProgressEventEmitter } from "../components";
import { ACCESS_DENIED_ROUTE_PATH } from "../constants";
import { useAppStore, useTabStore } from "../stores";
import { handleClientLogout } from "./auth";
import { onAccessDenied, onUnauthenticated } from "./event";
import { resolveActiveMenuKey } from "./menu-key";

export interface RouterOptions<TRouteTree extends AnyRouteWithContext<RouterContext> = AnyRouteWithContext<RouterContext>> {
  history: "hash" | "browser";
  routeTree: TRouteTree;
  context: RouterContext;
}

const DEFAULT_GC_TIME = 10 * 60 * 1000;

export function createRouter<TRouteTree extends AnyRouteWithContext<RouterContext>>({
  history,
  routeTree,
  context
}: RouterOptions<TRouteTree>) {
  const router = createRouterInternal({
    routeTree,
    context,
    trailingSlash: "never",
    caseSensitive: true,
    history: history === "hash" ? createHashHistory() : createBrowserHistory(),
    search: { strict: true },
    notFoundMode: "root",
    defaultPendingComponent: () => <Loader description="玩命加载中, 请耐心等待..." descriptionSize={18} size={48} />,
    defaultErrorComponent: Error,
    defaultNotFoundComponent: NotFound,
    defaultPendingMs: 500,
    defaultPendingMinMs: 300,
    defaultStructuralSharing: true,
    defaultHashScrollIntoView: {
      behavior: "smooth",
      block: "start",
      inline: "center"
    },
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadGcTime: DEFAULT_GC_TIME,
    defaultGcTime: DEFAULT_GC_TIME,
    defaultViewTransition: false,
    async defaultOnCatch(error) {
      const stack = await getSanitizedErrorStack(error);
      showErrorNotification(
        <pre css={{ whiteSpace: "pre-wrap" }}>{stack}</pre>,
        { title: error.message || error.name }
      );
    }
  });

  router.subscribe("onBeforeLoad", ({ pathChanged }) => {
    if (pathChanged) {
      nProgressEventEmitter.emit("start");
    }
  });

  router.subscribe("onLoad", () => nProgressEventEmitter.emit("complete"));

  router.subscribe("onLoad", event => {
    const location = event.toLocation;
    const match = router
      .matchRoutes(location.pathname, location.search, { preload: false, throwOnError: false })
      .at(-1)!;

    const {
      fullPath,
      params,
      search,
      context: matchContext
    } = match;
    const { userMenuMap } = useAppStore.getState();
    const { addTab, setActiveTabId } = useTabStore.getState();

    const id = `${fullPath}|${hashKey(search)}|${hashKey(params)}`;
    const activeMenuKey = userMenuMap
      ? resolveActiveMenuKey(userMenuMap.values(), {
          fullPath,
          params,
          search
        })
      : undefined;
    const userMenu = activeMenuKey ? userMenuMap?.get(activeMenuKey) : undefined;

    if (userMenu) {
      addTab({
        id,
        fullPath,
        params,
        search,
        label: matchContext.routeTitle || userMenu.name
      });
      setActiveTabId(id);
    }
  });

  onAccessDenied(() => {
    router.navigate({ to: ACCESS_DENIED_ROUTE_PATH });
  });

  onUnauthenticated(() => {
    handleClientLogout(router);
  });

  return router;
}
