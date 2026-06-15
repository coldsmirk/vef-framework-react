import type { XYPosition } from "@xyflow/react";

import type { FlowNode } from "../types";

/**
 * Minimum distance (per axis) between a proposed position and an existing
 * node before the proposal is considered occupied.
 */
const OCCUPIED_TOLERANCE = 24;

/**
 * Diagonal step applied while searching for a free spot, sized so stacked
 * nodes cascade visibly instead of piling on one point.
 */
const CASCADE_STEP = 32;

const MAX_ATTEMPTS = 50;

/**
 * Find a position at or near `preferred` that is not already occupied by a
 * node, cascading down-right in fixed steps. Click-to-add targets the viewport
 * center, so consecutive adds would otherwise stack invisibly on one spot.
 */
export function findFreePosition(preferred: XYPosition, nodes: readonly FlowNode[]): XYPosition {
  const position = { ...preferred };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const occupied = nodes.some(
      node => Math.abs(node.position.x - position.x) < OCCUPIED_TOLERANCE
        && Math.abs(node.position.y - position.y) < OCCUPIED_TOLERANCE
    );

    if (!occupied) {
      return position;
    }

    position.x += CASCADE_STEP;
    position.y += CASCADE_STEP;
  }

  return position;
}
