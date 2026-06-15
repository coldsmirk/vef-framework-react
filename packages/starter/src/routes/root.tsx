import { Outlet, useLocation, useRouteContext } from "@tanstack/react-router";
import { useDocumentTitle } from "@vef-framework-react/hooks";

import { useAppStore } from "../stores";

interface RootProps {
  appTitle: string;
}

export function createRootRouteOptions({ appTitle }: RootProps) {
  function RootComponent() {
    const title = useRouteContext({ strict: false, select: context => context.title });
    const pathname = useLocation({ select: location => location.pathname });
    const userMenuMap = useAppStore(state => state.userMenuMap);

    const titleToUse = title || userMenuMap?.get(pathname)?.name;
    const documentTitle = titleToUse ? `${appTitle} | ${titleToUse}` : appTitle;
    useDocumentTitle(documentTitle);

    return <Outlet />;
  }

  return { component: RootComponent, ssr: false } as const;
}
