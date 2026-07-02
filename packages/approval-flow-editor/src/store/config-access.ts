import type { FlowNode } from "@coldsmirk/nodeloom-core";

import type { AnyNodeData, NodeDataMap, NodeKind } from "../types";

/**
 * Typed access to a node's business fields — the package's single erasure boundary. The engine
 * stores `config` erased (`Record<string, unknown>`); the wire-level `kind` ↔ data correlation is
 * re-established here in one place instead of per-component casts: the guard narrows on the
 * node's own `kind` discriminator, so asking for the wrong kind yields `undefined`, never a
 * mistyped object.
 */
export function nodeConfig<K extends NodeKind>(node: FlowNode | undefined, kind: K): NodeDataMap[K] | undefined {
  if (!node || node.data.kind !== kind) {
    return undefined;
  }

  return node.data.config as NodeDataMap[K];
}

/**
 * Kind-agnostic view of a node's business fields, for surfaces that only touch the shared
 * `BaseNodeData` shape (name / description).
 */
export function anyNodeConfig(node: FlowNode | undefined): AnyNodeData | undefined {
  return node?.data.config as AnyNodeData | undefined;
}

/**
 * `nodeConfig`'s data-level twin, for canvas components that receive `NodeProps` (`data` without
 * the node wrapper). Same single-boundary guarantee: narrows on the `kind` discriminator.
 */
export function dataConfig<K extends NodeKind>(data: FlowNode["data"], kind: K): NodeDataMap[K] | undefined {
  if (data.kind !== kind) {
    return undefined;
  }

  return data.config as NodeDataMap[K];
}
