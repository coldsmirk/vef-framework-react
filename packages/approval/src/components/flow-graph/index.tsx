import type { NodeKind } from "@vef-framework-react/approval-flow-editor";
import type { Edge, Node, NodeTypes } from "@xyflow/react";

import type { FlowGraphNodeData, InstanceFlowGraph, NodeProgressStatus } from "../../types";

import { css, Global } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { Background, BackgroundVariant, MarkerType, ReactFlow } from "@xyflow/react";
import reactFlowBaseCss from "@xyflow/react/dist/base.css?raw";
import { useMemo } from "react";

import { ViewerNode } from "./node";

/**
 * react-flow base styles wrapped in `@layer` for easy overriding. Injected via
 * `<Global>` — a top-level `@layer` nested under an Emotion class selector
 * would be invalid CSS (see the flow editor's identical treatment).
 */
const reactFlowGlobalBaseStyle = css`
  @layer react-flow {
    ${reactFlowBaseCss}
  }
`;

const NODE_TYPES: NodeTypes = {
  start: ViewerNode,
  approval: ViewerNode,
  handle: ViewerNode,
  condition: ViewerNode,
  cc: ViewerNode,
  end: ViewerNode
};

const PRO_OPTIONS = { hideAttribution: true };

const containerStyle = css({
  width: "100%",
  height: "100%",
  minHeight: 360,

  ".react-flow__handle": {
    width: 6,
    height: 6,
    background: globalCssVars.colorBorder,
    border: "none"
  }
});

export interface InstanceFlowGraphViewerProps {
  flowGraph: InstanceFlowGraph;
  /**
   * Container height. The viewer always fills its width.
   *
   * @default 420
   */
  height?: number | string;
}

/**
 * The read-only, progress-annotated map of an instance's flow: node positions
 * come from the designer verbatim, progress colors the borders (blue = in
 * motion, green = passed, red = rejected, orange = returned) and dashes the
 * outline of everything the instance never reached, and the people involved
 * float above each node they touched. Pan and zoom only — nothing is editable.
 */
export function InstanceFlowGraphViewer({ flowGraph, height = 420 }: InstanceFlowGraphViewerProps) {
  const nodes = useMemo<Array<Node<FlowGraphNodeData & Record<string, unknown>, NodeKind>>>(
    () => flowGraph.nodes.map(node => {
      return {
        id: node.id,
        type: node.kind,
        position: node.position,
        data: { ...node.data },
        draggable: false,
        connectable: false
      };
    }),
    [flowGraph]
  );

  // Node progress by React Flow node id, for edge traversal coloring.
  const progressById = useMemo(() => {
    const map = new Map<string, NodeProgressStatus>();

    for (const node of flowGraph.nodes) {
      map.set(node.id, node.data.status);
    }

    return map;
  }, [flowGraph]);

  const edges = useMemo<Edge[]>(
    () => flowGraph.edges.map(edge => {
      // An edge reads as traversed when its source concluded and its target
      // was reached — the walked path stays visible at a glance.
      const sourceStatus = progressById.get(edge.source);
      const targetStatus = progressById.get(edge.target);
      const traversed = sourceStatus !== undefined
        && sourceStatus !== "pending"
        && sourceStatus !== "active"
        && targetStatus !== undefined
        && targetStatus !== "pending";

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        // The designer's per-branch source handles are not reproduced in the
        // read-only card, so edges attach to the single right-side handle.
        type: "smoothstep",
        style: traversed
          ? { stroke: globalCssVars.colorPrimary, strokeWidth: 1.8 }
          : {
              stroke: globalCssVars.colorBorder,
              strokeWidth: 1.4,
              strokeDasharray: "6 4"
            },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: traversed ? globalCssVars.colorPrimary : globalCssVars.colorBorder
        }
      };
    }),
    [flowGraph, progressById]
  );

  return (
    <div css={containerStyle} style={{ height }}>
      <Global styles={reactFlowGlobalBaseStyle} />

      <ReactFlow
        fitView
        panOnScroll
        edges={edges}
        edgesFocusable={false}
        elementsSelectable={false}
        fitViewOptions={{ padding: 0.28, maxZoom: 1 }}
        maxZoom={1.6}
        minZoom={0.2}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        nodeTypes={NODE_TYPES}
        proOptions={PRO_OPTIONS}
      >
        <Background gap={16} size={1} variant={BackgroundVariant.Dots} />
      </ReactFlow>
    </div>
  );
}
