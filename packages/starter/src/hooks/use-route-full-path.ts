import { useLocation, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";

export function useRouteFullPath(): string {
  const router = useRouter();
  const { pathname, search } = useLocation({
    select: location => { return { pathname: location.pathname, search: location.search }; }
  });

  return useMemo(() => {
    const match = router
      .matchRoutes(pathname, search, { preload: false, throwOnError: false })
      .at(-1)!;

    return match.fullPath as string;
  }, [pathname, router, search]);
}
