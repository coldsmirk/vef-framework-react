import { Outlet, useRouteContext } from "@tanstack/react-router";
import { useDocumentTitle } from "@vef-framework-react/hooks";

import { useActiveMenuKey } from "../hooks";
import { useAppStore } from "../stores";

interface RootProps {
  appTitle: string;
}

export function createRootRouteOptions({ appTitle }: RootProps) {
  function RootComponent() {
    const title = useRouteContext({ strict: false, select: context => context.routeTitle });
    const activeMenuKey = useActiveMenuKey();
    const userMenuMap = useAppStore(state => state.userMenuMap);

    const titleToUse = title || (activeMenuKey ? userMenuMap?.get(activeMenuKey)?.name : undefined);
    const documentTitle = titleToUse ? `${appTitle} | ${titleToUse}` : appTitle;
    useDocumentTitle(documentTitle);

    return <Outlet />;
  }

  return { component: RootComponent, ssr: false } as const;
}
