/**
 * The typed vocabularies the backend shares with management UIs. Each mirrors
 * a Go enum verbatim and must stay in lockstep with it; display labels and
 * colors live with the presentation components, not here.
 */

/**
 * The two integration flows an adapter can implement.
 */
export const DIRECTIONS = ["outbound", "inbound"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/**
 * How a failed invocation is classified, across the log, stats and API errors.
 */
export const FAILURE_KINDS = [
  "input_invalid",
  "output_invalid",
  "upstream",
  "transport",
  "timeout",
  "canceled",
  "script",
  "config",
  "auth",
  "handler"
] as const;
export type FailureKind = (typeof FAILURE_KINDS)[number];

/**
 * How one routing-diagnosis finding is classified.
 */
export const ROUTE_FINDING_KINDS = [
  "dangling_adapter",
  "wildcard_gap",
  "disabled_system",
  "disabled_contract",
  "uncovered_contract"
] as const;
export type RouteFindingKind = (typeof ROUTE_FINDING_KINDS)[number];

/**
 * Built-in outbound authentication schemes a system's `outboundAuth` may
 * select.
 */
export const OUTBOUND_AUTH_SCHEMES = ["none", "http_basic", "bearer", "header", "query", "signature", "script"] as const;
export type OutboundAuthScheme = (typeof OUTBOUND_AUTH_SCHEMES)[number];

/**
 * Built-in inbound authentication schemes a system's `inboundAuth` may select.
 * `ip` is inbound-only — a source address is verifiable only on receive.
 */
export const INBOUND_AUTH_SCHEMES = ["none", "ip", "http_basic", "bearer", "header", "query", "signature", "script"] as const;
export type InboundAuthScheme = (typeof INBOUND_AUTH_SCHEMES)[number];

/**
 * How far a system's data source lets adapter scripts go: read-only querying
 * (the default) or full read-write exchange. An empty value means read-only.
 */
export const DATA_SOURCE_MODES = ["read_only", "read_write"] as const;
export type DataSourceMode = (typeof DATA_SOURCE_MODES)[number];

/**
 * The placeholder the management API returns in place of a stored secret.
 * Submitting it back on update keeps the existing value unchanged.
 */
export const MASKED_SECRET = "******";
