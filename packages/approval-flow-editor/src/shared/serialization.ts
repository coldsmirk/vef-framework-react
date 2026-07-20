import type { FlowDefinition, FlowEdge, FlowNode, NodeDefinition } from "../types";

import { generateId } from "@vef-framework-react/shared";

import { EDGE_MARKER_END, NODE_RULES } from "../constants";
import { normalizeNodeData } from "./normalize-node-data";

/**
 * Map one live node to its backend definition. The per-kind switch lets TS verify
 * the `kind` ↔ `data` correlation — a drift in `NodeDataMap` becomes a compile
 * error here — instead of asserting it away with a whole-object cast. Exhaustive,
 * so a new node kind fails to compile until handled.
 */
function toNodeDefinition(node: FlowNode): NodeDefinition {
  switch (node.type) {
    case "start": { return {
      id: node.id,
      kind: "start",
      position: node.position,
      data: node.data
    }; }

    case "end": { return {
      id: node.id,
      kind: "end",
      position: node.position,
      data: node.data
    }; }

    case "approval": { return {
      id: node.id,
      kind: "approval",
      position: node.position,
      data: node.data
    }; }

    case "handle": { return {
      id: node.id,
      kind: "handle",
      position: node.position,
      data: node.data
    }; }

    case "condition": { return {
      id: node.id,
      kind: "condition",
      position: node.position,
      data: node.data
    }; }

    case "cc": { return {
      id: node.id,
      kind: "cc",
      position: node.position,
      data: node.data
    }; }
  }
}

/**
 * Convert xyflow nodes and edges to backend FlowDefinition format.
 *
 * React Flow's node discriminator is `type`; the backend NodeDefinition uses
 * `kind`. The node `data` (backend-aligned field names) keeps its field shape
 * unchanged.
 *
 * The returned definition is a detached deep copy — it never aliases live
 * editor state (`core/immer` disables auto-freeze, so an aliasing definition
 * would let host mutations silently rewrite store state without a zustand
 * notification). Hosts may retain, mutate, or persist it freely.
 */
export function toFlowDefinition(nodes: FlowNode[], edges: FlowEdge[]): FlowDefinition {
  return structuredClone({
    nodes: nodes.map(node => toNodeDefinition(node)),
    edges: edges.map(edge => {
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        data: edge.data
      };
    })
  });
}

/**
 * Map one backend definition to a live node. Per-kind so TS verifies the
 * `type` ↔ `data` correlation without a cast (inverse of {@link toNodeDefinition}).
 *
 * Hydration normalizes node data: omitted fields resolve to designer defaults
 * (see {@link normalizeNodeData}), so definitions saved by older editors or
 * authored externally still round-trip to fully-explicit configuration.
 *
 * Position and data are copied, never aliased — store state must not share
 * references with the host's definition object, or host mutations would
 * rewrite store state behind zustand's back (nothing is frozen at runtime).
 *
 * `deletable` is derived from NODE_RULES (not persisted): xyflow's native delete
 * flow skips non-deletable nodes while still cascading edge removal for deleted
 * neighbors, which keeps the graph free of dangling edges.
 */
function toFlowNode(node: NodeDefinition): FlowNode {
  switch (node.kind) {
    case "start": { return {
      id: node.id,
      type: "start",
      position: { ...node.position },
      deletable: NODE_RULES.start.deletable,
      data: normalizeNodeData("start", node.data ?? {})
    }; }

    case "end": { return {
      id: node.id,
      type: "end",
      position: { ...node.position },
      deletable: NODE_RULES.end.deletable,
      data: normalizeNodeData("end", node.data ?? {})
    }; }

    case "approval": { return {
      id: node.id,
      type: "approval",
      position: { ...node.position },
      deletable: NODE_RULES.approval.deletable,
      data: normalizeNodeData("approval", node.data ?? {})
    }; }

    case "handle": { return {
      id: node.id,
      type: "handle",
      position: { ...node.position },
      deletable: NODE_RULES.handle.deletable,
      data: normalizeNodeData("handle", node.data ?? {})
    }; }

    case "condition": { return {
      id: node.id,
      type: "condition",
      position: { ...node.position },
      deletable: NODE_RULES.condition.deletable,
      data: normalizeNodeData("condition", node.data ?? {})
    }; }

    case "cc": { return {
      id: node.id,
      type: "cc",
      position: { ...node.position },
      deletable: NODE_RULES.cc.deletable,
      data: normalizeNodeData("cc", node.data ?? {})
    }; }
  }
}

/**
 * Convert backend FlowDefinition to xyflow nodes and edges.
 *
 * Inverse of {@link toFlowDefinition}: the backend `kind` becomes React Flow's
 * `type`. Hydrated nodes and edges are detached from the definition object —
 * positions and data are deep-copied (see {@link toFlowNode}), so a host
 * mutating the definition it passed in cannot bypass the store.
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
        data: structuredClone(edge.data)
      };
    })
  };
}
