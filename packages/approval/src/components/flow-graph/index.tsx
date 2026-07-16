import type { NodeKind } from "@vef-framework-react/approval-flow-editor";
import type { Edge, Node, NodeProps, NodeTypes } from "@xyflow/react";
import type { FC } from "react";

import type { FlowGraphNodeData, InstanceFlowGraph, NodeProgressStatus } from "../../types";

import { css, Global } from "@emotion/react";
import { NODE_KIND_COLORS } from "@vef-framework-react/approval-flow-editor";
import { globalCssVars, Icon, Tooltip } from "@vef-framework-react/components";
import { Background, BackgroundVariant, Handle, MarkerType, Position, ReactFlow } from "@xyflow/react";
import reactFlowBaseCss from "@xyflow/react/dist/base.css?raw";
import {
  BadgeCheckIcon,
  CirclePlayIcon,
  CircleStopIcon,
  ClipboardPenIcon,
  GitForkIcon,
  MailIcon
} from "lucide-react";
import { useMemo } from "react";

import { NODE_PROGRESS_LABELS } from "../status/labels";

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

const NODE_KIND_ICONS: Record<NodeKind, FC> = {
  start: CirclePlayIcon,
  approval: BadgeCheckIcon,
  handle: ClipboardPenIcon,
  condition: GitForkIcon,
  cc: MailIcon,
  end: CircleStopIcon
};

/**
 * Progress accents as adaptive theme tokens: the border, status dot, and
 * active glow all derive from one accent per status.
 */
const PROGRESS_ACCENTS: Record<NodeProgressStatus, string> = {
  pending: globalCssVars.colorBorder,
  active: globalCssVars.colorPrimary,
  passed: globalCssVars.colorSuccess,
  rejected: globalCssVars.colorError,
  returned: globalCssVars.colorWarning,
  canceled: globalCssVars.colorBorder
};

const nodeCardStyle = css({
  minWidth: 180,
  maxWidth: 240,
  borderRadius: 10,
  border: "1.5px solid var(--vef-approval-node-accent)",
  background: globalCssVars.colorBgContainer,
  boxShadow: "var(--vef-approval-node-glow, none)",
  padding: "10px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 6,

  ".vef-approval-node-header": {
    display: "flex",
    alignItems: "center",
    gap: 8
  },

  ".vef-approval-node-badge": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: 7,
    flexShrink: 0,
    color: "var(--vef-approval-node-kind)",
    background: "color-mix(in srgb, var(--vef-approval-node-kind) 13%, transparent)",
    fontSize: 14
  },

  ".vef-approval-node-name": {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: 500,
    fontSize: 13,
    color: globalCssVars.colorText
  },

  ".vef-approval-node-status": {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: globalCssVars.fontSizeSm,
    color: globalCssVars.colorTextSecondary
  },

  ".vef-approval-node-dot": {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: "var(--vef-approval-node-accent)",
    flexShrink: 0
  },

  ".vef-approval-node-people": {
    fontSize: globalCssVars.fontSizeSm,
    color: globalCssVars.colorTextTertiary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },

  "&[data-progress=\"pending\"]": {
    opacity: 0.62
  },

  "&[data-progress=\"active\"]": {
    "@media (prefers-reduced-motion: no-preference)": {
      animation: "vef-approval-node-pulse 2.4s ease-in-out infinite"
    }
  },

  "@keyframes vef-approval-node-pulse": {
    "0%, 100%": { boxShadow: "0 0 0 0 color-mix(in srgb, var(--vef-approval-node-accent) 32%, transparent)" },
    "50%": { boxShadow: "0 0 0 6px color-mix(in srgb, var(--vef-approval-node-accent) 8%, transparent)" }
  }
});

/**
 * CSSProperties cannot carry custom `--*` keys without an explicit record
 * type (mirrors the flow editor's NodeAccentStyle treatment).
 */
type ViewerAccentStyle = Record<`--vef-approval-node-${string}`, string>;

/**
 * One runtime node: kind badge + name on top, progress status beneath, and a
 * compact participant summary when people are involved. The full per-person
 * detail lives in the timeline — the graph stays a map, not a table.
 */
function ViewerNode({ data, type }: NodeProps<Node<FlowGraphNodeData & Record<string, unknown>, NodeKind>>) {
  const kind: NodeKind = type;
  const KindIcon = NODE_KIND_ICONS[kind];
  const accent = PROGRESS_ACCENTS[data.status];

  const participants = data.participants ?? [];
  const peopleSummary = participants
    .map(participant => participant.user.name || participant.user.id)
    .join("、");

  const accentStyle: ViewerAccentStyle = {
    "--vef-approval-node-accent": accent,
    "--vef-approval-node-kind": NODE_KIND_COLORS[kind]
  };

  return (
    <div css={nodeCardStyle} data-progress={data.status} style={accentStyle}>
      <div className="vef-approval-node-header">
        <span className="vef-approval-node-badge">
          <Icon component={KindIcon} />
        </span>

        <Tooltip title={data.name}>
          <span className="vef-approval-node-name">{data.name}</span>
        </Tooltip>
      </div>

      <span className="vef-approval-node-status">
        <span className="vef-approval-node-dot" />
        {NODE_PROGRESS_LABELS[data.status]}
      </span>

      {peopleSummary !== "" && (
        <Tooltip title={peopleSummary}>
          <span className="vef-approval-node-people">{peopleSummary}</span>
        </Tooltip>
      )}

      {kind !== "start" && <Handle isConnectable={false} position={Position.Left} type="target" />}
      {kind !== "end" && <Handle isConnectable={false} position={Position.Right} type="source" />}
    </div>
  );
}

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
 * motion, green = passed, red = rejected, orange = returned; unreached nodes
 * fade back). Pan and zoom only — nothing is editable.
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
          : { stroke: globalCssVars.colorBorder, strokeWidth: 1.4 },
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
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
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
