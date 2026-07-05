import type { NodeKind } from "../types";
import type { NodeSpecification } from "./types";

import { NODE_RULES } from "../constants";
import { approvalSpecification } from "./approval";
import { ccSpecification } from "./cc";
import { conditionSpecification } from "./condition";
import { endSpecification } from "./end";
import { handleSpecification } from "./handle";
import { startSpecification } from "./start";

export type { NodeSpecification } from "./types";

/**
 * Registry of all node specifications
 */
const specifications = new Map<NodeKind, NodeSpecification>([
  ["start", startSpecification],
  ["approval", approvalSpecification],
  ["handle", handleSpecification],
  ["condition", conditionSpecification],
  ["cc", ccSpecification],
  ["end", endSpecification]
]);

/**
 * Get specification for a node kind
 */
export function getSpecification(kind: NodeKind): NodeSpecification {
  const spec = specifications.get(kind);

  if (!spec) {
    throw new Error(`Unknown node kind: "${kind}"`);
  }

  return spec;
}

/**
 * Get all registered specifications
 */
export function getAllSpecifications(): NodeSpecification[] {
  return specifications.values().toArray();
}

/**
 * Get specifications for node kinds the user may add from the toolbar
 */
export function getAddableSpecifications(): NodeSpecification[] {
  return getAllSpecifications().filter(spec => NODE_RULES[spec.type].addable);
}
