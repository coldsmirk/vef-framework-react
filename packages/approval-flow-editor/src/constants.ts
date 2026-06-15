import type { NodeDataMap, NodeKind } from "./types";

import { MarkerType } from "@xyflow/react";

/**
 * Arrowhead rendered on every edge — an approval flow is a directed graph, so
 * direction must survive any manual layout. xyflow's stock solid arrow at its
 * default size, the same geometry the upstream demos ship (the marker scales
 * with the edge stroke via `markerUnits="strokeWidth"`; the tip anchors at
 * the path end, flush against the target handle). What used to make it look
 * wrong was never the size but the PAINT: the glyph strokes on top of its
 * own fill, so a translucent color renders two-tone (hollow outline) — fixed
 * at the theme level by flattening the edge-stroke variable to an opaque
 * equivalent (see editorThemeStyle). The color rides that same variable, so
 * the arrow stays in sync with the edge and with light/dark theming. Applied
 * at edge construction (hydration and defaultEdgeOptions); never serialized
 * into the backend definition.
 */
export const EDGE_MARKER_END = {
  type: MarkerType.ArrowClosed,
  color: "var(--xy-edge-stroke-default)"
} as const;

/**
 * All available node kinds
 */
export const NODE_KINDS: readonly NodeKind[] = ["start", "approval", "handle", "condition", "cc", "end"] as const;

/**
 * Narrows an arbitrary string to a NodeKind (one of the valid node kinds).
 */
export function isNodeKind(kind: string): kind is NodeKind {
  return (NODE_KINDS as readonly string[]).includes(kind);
}

/**
 * Node kind labels (Chinese)
 */
export const NODE_KIND_LABELS: Record<NodeKind, string> = {
  start: "开始",
  approval: "审批",
  handle: "办理",
  condition: "条件",
  cc: "抄送",
  end: "结束"
};

/**
 * Structural rule for a node kind.
 */
export interface NodeRule {
  /**
   * Maximum count allowed in a flow (e.g. 1 for start/end)
   */
  maxCount?: number;
  /**
   * Whether the user may delete nodes of this kind. Mapped onto xyflow's native
   * node `deletable` flag at node construction, so delete flows (Backspace,
   * deleteElements) skip the node itself while still cascading edge removal
   * for its deletable neighbors.
   */
  deletable: boolean;
  /**
   * Whether the kind appears in the toolbar and may be added to the canvas.
   * Deliberately separate from `deletable` — the two concepts only coincide
   * for start/end today.
   */
  addable: boolean;
}

/**
 * Structural rules per node kind, enforced by the store (`addNode`) and mapped
 * onto xyflow node flags at construction (`fromFlowDefinition` / `addNode`).
 * Kept free of UI concerns so the store and serialization layers never import
 * React component modules.
 */
export const NODE_RULES: Record<NodeKind, NodeRule> = {
  start: {
    maxCount: 1,
    deletable: false,
    addable: false
  },
  approval: { deletable: true, addable: true },
  handle: { deletable: true, addable: true },
  condition: { deletable: true, addable: true },
  cc: { deletable: true, addable: true },
  end: {
    maxCount: 1,
    deletable: false,
    addable: false
  }
};

/**
 * Default node dimensions
 */
export const NODE_DIMENSIONS = {
  width: 200,
  height: 60
} as const;

/**
 * Recursively freeze a config object together with its nested arrays/objects.
 */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    Object.freeze(value);
  }

  return value;
}

/**
 * Default new node data by kind. Deep-frozen: these objects are shared module
 * state exported to hosts, so a mutation must throw (strict mode) instead of
 * silently corrupting the defaults for every node created afterwards.
 * Consumers clone before customizing — `addNode` structuredClones its entry
 * (cloning a frozen object yields a plain mutable clone).
 */
export const DEFAULT_NODE_DATA: Record<NodeKind, Record<string, unknown>> = deepFreeze({
  start: { name: "开始" },
  approval: { name: "审批节点" },
  handle: { name: "办理节点" },
  condition: {
    name: "条件节点",
    branches: [
      {
        id: "branch_1",
        label: "条件1",
        priority: 1
      },
      {
        id: "branch_default",
        label: "默认",
        isDefault: true,
        priority: 99
      }
    ]
  },
  cc: { name: "抄送节点" },
  end: { name: "结束" }
  // `satisfies` validates each kind's defaults against its typed data shape (so a
  // typo like a misnamed branch field is a compile error here) while the wider
  // declared type keeps `DEFAULT_NODE_DATA[kind]` usable where `kind` is a
  // runtime NodeKind (e.g. addNode) without tripping the correlated-union check.
} satisfies { [K in NodeKind]: Partial<NodeDataMap[K]> });
