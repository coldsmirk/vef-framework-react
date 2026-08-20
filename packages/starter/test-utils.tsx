import type { AnyRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";

export * from "@testing-library/react";

export interface RouterHarnessOptions {
  /**
   * The location to render at, including any query string. Anything reading
   * search parameters (`useSearch`) needs it; the default is the bare root.
   */
  initialEntry?: string;
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
async function mountRoute(component: () => ReactNode, initialEntry: string): Promise<AnyRouter> {
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
    history: createMemoryHistory({ initialEntries: [initialEntry] })
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
  { initialEntry = "/" }: RouterHarnessOptions = {}
): Promise<RenderRouterHookResult<T>> {
  const result = { current: undefined as T };

  const router = await mountRoute(() => {
    result.current = useHook();

    return null;
  }, initialEntry);

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
  { initialEntry = "/" }: RouterHarnessOptions = {}
): Promise<RenderInRouterResult> {
  const router = await mountRoute(() => element, initialEntry);

  return { router };
}
