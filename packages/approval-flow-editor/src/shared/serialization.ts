import type { FlowEdge, FlowNode } from "@coldsmirk/nodeloom-core";

import type { FlowDefinition, NodeDefinition } from "../types";

import { generateId } from "@vef-framework-react/shared";

import { EDGE_MARKER_END, isNodeKind, NODE_KIND_LABELS, NODE_RULES } from "../constants";
import { normalizeNodeData } from "./normalize-node-data";

/**
 * Map one live node to its backend definition. The engine's in-memory shape carries the wire
 * `kind` in `data.kind` and the business fields in `data.config`; the wire shape flattens config
 * back to `data`. An unknown kind (a definition authored against a newer editor) throws rather
 * than silently emitting a definition the backend would reject.
 */
function toNodeDefinition(node: FlowNode): NodeDefinition {
  const { kind } = node.data;

  if (!isNodeKind(kind)) {
    throw new Error(`Cannot serialize node "${node.id}": unknown kind "${kind}"`);
  }

  return {
    id: node.id,
    kind,
    position: node.position,
    // The kind ↔ config correlation is maintained by construction (fromFlowDefinition and
    // addNode both normalize per kind); serialization re-asserts it at this single boundary.
    data: node.data.config as NodeDefinition["data"]
  } as NodeDefinition;
}

/**
 * Convert live nodes and edges to the backend FlowDefinition format.
 *
 * The engine's node discriminator lives in `data.kind`; the backend NodeDefinition uses a
 * top-level `kind` with the business fields as `data`. Edge business data is unwrapped from the
 * engine's `data.config` (an empty config serializes as no `data`, matching definitions the old
 * editor emitted).
 *
 * The returned definition is a detached deep copy — it never aliases live editor state, so hosts
 * may retain, mutate, or persist it freely.
 */
export function toFlowDefinition(nodes: FlowNode[], edges: FlowEdge[]): FlowDefinition {
  return structuredClone({
    nodes: nodes.map(node => toNodeDefinition(node)),
    edges: edges.map(edge => {
      const config = edge.data?.config;

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        data: config && Object.keys(config).length > 0 ? config : undefined
      };
    })
  });
}

/**
 * Map one backend definition to a live engine node.
 *
 * Hydration normalizes node data: omitted fields resolve to designer defaults (see
 * {@link normalizeNodeData}), so definitions saved by older editors or authored externally still
 * round-trip to fully-explicit configuration. `label` is the static kind label — the node's
 * display name stays `config.name`, the only wire field.
 *
 * Position and data are copied, never aliased — store state must not share references with the
 * host's definition object.
 *
 * `deletable` is derived from NODE_RULES (not persisted): the canvas's native delete flow skips
 * non-deletable nodes while still cascading edge removal for deleted neighbors.
 */
function toFlowNode(node: NodeDefinition): FlowNode {
  const { kind } = node;

  return {
    id: node.id,
    type: "flowNode",
    position: { ...node.position },
    deletable: NODE_RULES[kind].deletable,
    data: {
      kind,
      label: NODE_KIND_LABELS[kind],
      config: normalizeNodeData(kind, structuredClone(node.data ?? {}) as NonNullable<typeof node.data>)
    }
  };
}

/**
 * Convert backend FlowDefinition to live engine nodes and edges.
 *
 * Inverse of {@link toFlowDefinition}. Hydrated nodes and edges are detached from the definition
 * object — positions and data are deep-copied, so a host mutating the definition it passed in
 * cannot bypass the store. Edge business data is wrapped into the engine's `{ kind, config }`
 * edge-data shape; the arrowhead marker is attached at hydration and never serialized.
 */
export function fromFlowDefinition(definition: FlowDefinition): {
  nodes: FlowNode[];
  edges: FlowEdge[];
} {
  return {
    nodes: definition.nodes.map(node => toFlowNode(node)),
    edges: definition.edges.map(edge => {
      return {
        id: edge.id ?? `edge_${generateId()}`,
        type: "approval",
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: null,
        markerEnd: EDGE_MARKER_END,
        data: { kind: "approval", config: structuredClone(edge.data ?? {}) }
      };
    })
  };
}
