import type ElkConstructor from "elkjs/lib/elk.bundled.js";

import type { FlowEdge, FlowNode } from "../types";

import { showErrorMessage } from "@vef-framework-react/components";
import { useReactFlow } from "@xyflow/react";
import { useState } from "react";

import { NODE_DIMENSIONS } from "../constants";
import { useEditorStoreApi } from "../store";

type ElkInstance = InstanceType<typeof ElkConstructor>;

// elkjs is ~1.5 MB and only needed once the user actually clicks auto-layout,
// so it loads on demand instead of riding the editor bundle. The promise is
// cached module-wide; the isLayouting spinner already covers the first-click
// load time.
let elkPromise: Promise<ElkInstance> | null = null;

function loadElk(): Promise<ElkInstance> {
  elkPromise ??= import("elkjs/lib/elk.bundled.js").then(module => {
    const Elk = module.default;

    return new Elk();
  });

  return elkPromise;
}

const ELK_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.spacing.nodeNode": "40",
  "elk.layered.spacing.nodeNodeBetweenLayers": "80",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP"
};

export function useAutoLayout() {
  const storeApi = useEditorStoreApi();
  const { fitView } = useReactFlow();
  const [isLayouting, setIsLayouting] = useState(false);

  async function runLayout() {
    const {
      nodes,
      edges,
      updateNodePositions
    } = storeApi.getState();

    if (nodes.length === 0) {
      return;
    }

    setIsLayouting(true);

    try {
      const elk = await loadElk();
      const layouted = await elk.layout({
        id: "root",
        layoutOptions: ELK_OPTIONS,
        children: nodes.map((node: FlowNode) => {
          return {
            id: node.id,
            width: node.measured?.width ?? NODE_DIMENSIONS.width,
            height: node.measured?.height ?? NODE_DIMENSIONS.height
          };
        }),
        edges: edges.map((edge: FlowEdge) => {
          return {
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target]
          };
        })
      });

      const positions = new Map<string, { x: number; y: number }>();
      const layoutChildren = layouted.children ?? [];

      for (const child of layoutChildren) {
        if (child.x !== undefined && child.y !== undefined) {
          positions.set(child.id, { x: child.x, y: child.y });
        }
      }

      updateNodePositions(positions);

      // Wait for React to render new positions, then fit viewport
      requestAnimationFrame(() => {
        fitView({ duration: 300 });
      });
    } catch (error) {
      console.error("[approval-flow-editor] auto layout failed", error);
      showErrorMessage("自动布局失败");
    } finally {
      setIsLayouting(false);
    }
  }

  return { runLayout, isLayouting };
}
