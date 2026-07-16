import type { RouteFindingKind } from "./enums";

/**
 * One routing-diagnosis finding. `routeKey` is always meaningful (an empty
 * string is the default route); the code/name pairs identify the involved
 * route, contract, and system so the UI needs no extra lookups. Mirrors the
 * Go `integration.RouteFinding`.
 */
export interface RouteFinding {
  kind: RouteFindingKind;
  routeId?: string;
  routeKey: string;
  contractCode?: string;
  contractName?: string;
  systemCode?: string;
  systemName?: string;
}

/**
 * The point-in-time report of the routing table's configuration gaps.
 */
export interface RouteDiagnostics {
  findings: RouteFinding[];
}
