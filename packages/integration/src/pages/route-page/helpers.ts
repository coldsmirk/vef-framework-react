import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";

import type { Route, RouteParams, RouteSearch } from "../../types";

import { createCrudKit } from "@vef-framework-react/components";

/**
 * Create and update share the route params shape.
 */
export type RouteSceneValues = CrudBasicSceneFormValues<RouteParams, RouteParams>;

export const { OperationButtonGroup: RouteOperationButtonGroup, ActionButtonGroup: RouteActionButtonGroup }
  = createCrudKit<Route, RouteSearch, RouteSceneValues>();

/**
 * Project a saved route into its writable params, dropping the audit fields
 * the edit form must not submit back.
 */
export function routeToParams(row: Route): RouteParams {
  return {
    id: row.id,
    routeKey: row.routeKey,
    contractId: row.contractId,
    systemId: row.systemId,
    isEnabled: row.isEnabled
  };
}

/**
 * Defaults for a newly created route: the broadest catch-all (default key, all contracts).
 */
export const ROUTE_FORM_DEFAULTS: RouteParams = {
  routeKey: "",
  contractId: "",
  systemId: "",
  isEnabled: true
};
