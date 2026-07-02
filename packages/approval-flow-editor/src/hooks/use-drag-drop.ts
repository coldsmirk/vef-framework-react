import type { DragEvent } from "react";

import type { NodeKind } from "../types";

import { useReactFlow } from "@xyflow/react";
import { useCallback } from "react";

import { isNodeKind } from "../constants";
import { useApprovalActions } from "../store";

/**
 * MIME type for drag data
 */
const DRAG_DATA_TYPE = "application/approval-node-type";

export function handleDragStart(event: DragEvent, nodeType: NodeKind) {
  event.dataTransfer.setData(DRAG_DATA_TYPE, nodeType);
  event.dataTransfer.effectAllowed = "move";
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

/**
 * Get drop handlers for the canvas
 */
export function useDrop() {
  const { screenToFlowPosition } = useReactFlow();
  const { addNode } = useApprovalActions();

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData(DRAG_DATA_TYPE);

      if (!isNodeKind(type)) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });

      // The engine's addNode selects what it appends, so the config panel opens
      // right away — placing a node and configuring it are one task, not two.
      addNode(type, position);
    },
    [screenToFlowPosition, addNode]
  );

  return { onDragOver: handleDragOver, onDrop };
}
