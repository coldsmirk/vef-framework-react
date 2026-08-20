import type { AnyRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { createBrowserHistory, createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";

export * from "@testing-library/react";

export interface RouterHarnessOptions {
  /**
   * The location to render at, including any query string. Anything reading
   * search parameters (`useSearch`) needs it; the default is the bare root.
   */
  initialEntry?: string;
  /**
   * Which history drives the router. The default memory history keeps a test
   * isolated from `window.location`, which also means it never writes there —
   * so anything asserting on the address bar has to ask for "browser", or the
   * assertion holds no matter what the code does.
   */
  history?: "memory" | "browser";
}

/**
 * Mount a component as the only route of a memory router, and resolve once it
 * has actually rendered.
 *
 * Testing Library's `wrapper` option cannot host a router: `RouterProvider`
 * renders a route tree rather than its children, so whatever is under test has
 * to be the route's component. The router also resolves its matches
 * asynchronously, so the component has not run when `render` returns.
 *
 * StrictMode is deliberate: it double-invokes effects, which is exactly what a
 * "run this once" guard has to survive — and what React does in development
 * anyway, so anything that only works without it is already broken.
 */
function createHistory(kind: "memory" | "browser", initialEntry: string) {
  if (kind === "memory") {
    return createMemoryHistory({ initialEntries: [initialEntry] });
  }

  // createBrowserHistory reads the current location, so the entry is put there
  // first. This also leaves the URL where a test asserting on it can see it.
  history.replaceState(null, "", initialEntry);

  return createBrowserHistory();
}

async function mountRoute(component: () => ReactNode, initialEntry: string, historyKind: "memory" | "browser"): Promise<AnyRouter> {
  let rendered = false;

  function RouteComponent(): ReactNode {
    rendered = true;

    return component();
  }

  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    validateSearch: (search: Record<string, unknown>) => search,
    component: RouteComponent
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createHistory(historyKind, initialEntry)
  });

  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );

  await waitFor(() => {
    if (!rendered) {
      throw new Error("the route component has not rendered yet");
    }
  });

  return router;
}

export interface RenderRouterHookResult<T> {
  /**
   * The hook's latest return value. Read it at each assertion point rather
   * than destructuring, which would capture a stale render.
   */
  result: { current: T };
  /**
   * The router the hook rendered under, for asserting on navigation.
   */
  router: AnyRouter;
}

/**
 * Render a hook inside a real router.
 */
export async function renderRouterHook<T>(
  useHook: () => T,
  { initialEntry = "/", history = "memory" }: RouterHarnessOptions = {}
): Promise<RenderRouterHookResult<T>> {
  const result = { current: undefined as T };

  const router = await mountRoute(() => {
    result.current = useHook();

    return null;
  }, initialEntry, history);

  return { result, router };
}

export interface RenderInRouterResult {
  /**
   * The router the element rendered under, for asserting on navigation.
   */
  router: AnyRouter;
}

/**
 * Render an element inside a real router, for components that navigate or read
 * search parameters.
 */
export async function renderInRouter(
  element: ReactNode,
  { initialEntry = "/", history = "memory" }: RouterHarnessOptions = {}
): Promise<RenderInRouterResult> {
  const router = await mountRoute(() => element, initialEntry, history);

  return { router };
}
