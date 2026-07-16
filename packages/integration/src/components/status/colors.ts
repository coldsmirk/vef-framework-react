import type { Direction, FailureKind, RouteFindingKind } from "../../types";

/**
 * Status colors, expressed as antd Tag color tokens so they resolve through
 * the framework theme (and flip with the dark algorithm) with no hardcoding.
 * The two directions get distinct preset hues; failures and findings map onto
 * the semantic warning/error scenes by severity.
 */

export const DIRECTION_COLORS: Record<Direction, string> = {
  outbound: "blue",
  inbound: "purple"
};

export const FAILURE_KIND_COLORS: Record<FailureKind, string> = {
  input_invalid: "warning",
  auth: "warning",
  canceled: "default",
  output_invalid: "error",
  upstream: "error",
  transport: "error",
  timeout: "error",
  script: "error",
  config: "error",
  handler: "error"
};

/**
 * Whether a routing finding is an error (a broken route) or informational (a gap).
 */
export const ROUTE_FINDING_SEVERITY: Record<RouteFindingKind, "error" | "warning"> = {
  dangling_adapter: "error",
  disabled_system: "error",
  disabled_contract: "error",
  wildcard_gap: "warning",
  uncovered_contract: "warning"
};
