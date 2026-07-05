import { useLocation, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";

import { resolveActiveMenuKey } from "../helpers/menu-key";
import { useAppStore } from "../stores";

/**
 * Resolve the menu key the current route should highlight, honouring the params
 * and search a menu binds via `meta`. Several menus sharing one `/report/$key`
 * template but bound to different params no longer all light up — only the menu
 * whose bound identity matches the active route does. Returns undefined when no
 * menu owns the route.
 */
export function useActiveMenuKey(): string | undefined {
  const router = useRouter();
  const pathname = useLocation({ select: location => location.pathname });
  const search = useLocation({ select: location => location.search });
  const userMenuMap = useAppStore(state => state.userMenuMap);

  return useMemo(() => {
    if (!userMenuMap) {
      return;
    }

    const match = router
      .matchRoutes(pathname, search, { preload: false, throwOnError: false })
      .at(-1);

    if (!match) {
      return;
    }

    return resolveActiveMenuKey(userMenuMap.values(), {
      fullPath: match.fullPath,
      params: match.params,
      search: match.search
    });
  }, [router, pathname, search, userMenuMap]);
}
