import type { AnyRouter } from "@tanstack/react-router";

export interface RouterContext {
  router: AnyRouter;
  routeTitle?: string;
}
