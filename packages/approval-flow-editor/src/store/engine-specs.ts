import type { NodeSpec } from "@coldsmirk/nodeloom-core";

import type { NodeDataMap, NodeKind } from "../types";

import { createNodeRegistry } from "@coldsmirk/nodeloom-core";

import { DEFAULT_NODE_DATA, NODE_KIND_LABELS, NODE_KINDS, NODE_RULES } from "../constants";
import { normalizeNodeData } from "../shared/normalize-node-data";

/**
 * The engine-level node registry: structural rules (`deletable`, `maxCount`) and default data per
 * kind, derived from the same NODE_RULES / DEFAULT_NODE_DATA constants the package has always
 * exported — the constants stay the single source of truth for hosts, the registry is their
 * engine projection. UI concerns (icon, color, config panel) stay in `specifications/`, which the
 * canvas reads directly; `handles: []` because the node components render their own (the
 * condition node's per-branch handles are dynamic, so "one outgoing edge per source handle" is
 * enforced by the connection rule, not by static handle capacity.
 */
function engineSpec(kind: NodeKind): NodeSpec {
  const rule = NODE_RULES[kind];

  return {
    kind,
    label: NODE_KIND_LABELS[kind],
    handles: [],
    deletable: rule.deletable,
    ...rule.maxCount !== undefined && { maxCount: rule.maxCount },
    // Pure by contract (the engine may build throwaway candidates): a fresh clone of the frozen
    // default, resolved to fully-explicit designer defaults.
    createData: () => {
      return {
        kind,
        label: NODE_KIND_LABELS[kind],
        // `kind` is a runtime NodeKind, so the kind ↔ data correlation cannot be proven by the
        // correlated-union check — assert the cloned default (same limitation the old store had).
        config: normalizeNodeData(kind, structuredClone(DEFAULT_NODE_DATA[kind]) as NodeDataMap[typeof kind])
      };
    }
  };
}

export const engineNodeRegistry = createNodeRegistry(NODE_KINDS.map(kind => engineSpec(kind)));
