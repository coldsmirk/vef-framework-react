import type { FlowEdge, FlowNode } from "../types";

import { generateId } from "@vef-framework-react/shared";

import { NODE_DIMENSIONS, NODE_KIND_LABELS } from "../constants";
import { fromFlowDefinition } from "./serialization";

/**
 * Minimal valid flow seeded into an empty canvas: a start and an end node joined
 * by one edge. The editor owns the "exactly one start / at least one end"
 * invariant — start/end are neither deletable nor addable from the toolbar — so
 * an empty definition must hydrate to this baseline instead of an unbuildable
 * blank canvas.
 */
export function createSeedFlow(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const startId = `start_${generateId()}`;
  const endId = `end_${generateId()}`;

  return fromFlowDefinition({
    nodes: [
      {
        id: startId,
        kind: "start",
        position: { x: 0, y: 0 },
        data: { name: NODE_KIND_LABELS.start }
      },
      {
        id: endId,
        kind: "end",
        position: { x: NODE_DIMENSIONS.width * 2 + 80, y: 0 },
        data: { name: NODE_KIND_LABELS.end }
      }
    ],
    edges: [{ source: startId, target: endId }]
  });
}
