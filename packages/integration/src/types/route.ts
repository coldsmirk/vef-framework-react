import type { FullAudited } from "./base";

/**
 * A rule mapping a route key (tenant, branch, hospital area) to the system
 * serving a contract. An empty `contractId` scopes the rule to every
 * contract; an empty `routeKey` is the default route. Mirrors the Go
 * `integration.Route`.
 */
export interface Route extends FullAudited {
  routeKey: string;
  contractId: string;
  systemId: string;
  isEnabled: boolean;
}

/**
 * Create/update parameters for a route.
 */
export interface RouteParams {
  id?: string;
  routeKey?: string;
  contractId?: string;
  systemId: string;
  isEnabled: boolean;
}

/**
 * Search parameters for routes.
 */
export interface RouteSearch {
  routeKey?: string;
  contractId?: string;
  systemId?: string;
  isEnabled?: boolean;
}
