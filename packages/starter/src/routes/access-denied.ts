import type { AnyRouter, ParsedLocation } from "@tanstack/react-router";

import { AccessDenied } from "../components";
import { INDEX_ROUTE_PATH } from "../constants";

export function createAccessDeniedRouteOptions() {
  return {
    component: AccessDenied,
    beforeLoad({ location, context: { router } }: { location: ParsedLocation; context: { router: AnyRouter } }) {
      if (router.state.resolvedLocation) {
        return;
      }

      if (location.state.__TSR_index === 0) {
        router.navigate({ to: INDEX_ROUTE_PATH });
      } else {
        router.history.back();
      }
    }
  } as const;
}
