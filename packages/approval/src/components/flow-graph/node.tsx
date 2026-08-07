import type { NodeKind } from "@vef-framework-react/approval-flow-editor";
import type { Node, NodeProps } from "@xyflow/react";
import type { FC } from "react";

import type { FlowGraphNodeData, NodeProgressStatus } from "../../types";

import { css } from "@emotion/react";
import { NODE_KIND_COLORS } from "@vef-framework-react/approval-flow-editor";
import { globalCssVars, Icon, Tooltip } from "@vef-framework-react/components";
import { Handle, Position } from "@xyflow/react";
import {
  BadgeCheckIcon,
  CirclePlayIcon,
  CircleStopIcon,
  ClipboardPenIcon,
  GitForkIcon,
  MailIcon
} from "lucide-react";
import { useMemo } from "react";

import { formatTimestamp } from "../format";
import { NODE_PROGRESS_LABELS } from "../status/labels";
import { collectNodePeople } from "./people";
import { NodePeopleOverlay } from "./people-overlay";

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

/**
 * Whether the instance ever entered a node. It is the primary read of the
 * whole view — "which way did this actually go" — so it gets the strongest
 * visual signal available short of color: a dashed outline for the path not
 * taken, solid for the path walked.
 */
function isReached(status: NodeProgressStatus): boolean {
  return status !== "pending";
}

const nodeCardStyle = css({
  position: "relative",
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

  // Never entered: dashed and faded, so the untaken path is legible as such
  // even in grayscale, where the neutral accent alone would not separate it
  // from a canceled node.
  "&[data-reached=\"false\"]": {
    borderStyle: "dashed",
    background: "transparent",
    opacity: 0.55
  },

  "&[data-progress=\"canceled\"]": {
    opacity: 0.7
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
 * When a node was entered and, once concluded, when it finished — the span
 * behind "已通过", surfaced on hover so the card itself stays uncluttered.
 */
function timingTooltip(data: FlowGraphNodeData): string | undefined {
  if (!data.startedAt) {
    return undefined;
  }

  const started = `进入 ${formatTimestamp(data.startedAt)}`;

  return data.finishedAt ? `${started}｜结束 ${formatTimestamp(data.finishedAt)}` : started;
}

/**
 * One runtime node: the people involved float above the card, the kind badge
 * and name sit on top, and the progress status reads beneath. Per-person
 * detail lives in the avatars' hover cards; the full chronological account
 * stays in the timeline — the graph is a map, not a table.
 */
export function ViewerNode({ data, type }: NodeProps<Node<FlowGraphNodeData & Record<string, unknown>, NodeKind>>) {
  const kind: NodeKind = type;
  const KindIcon = NODE_KIND_ICONS[kind];
  const accent = PROGRESS_ACCENTS[data.status];
  const people = useMemo(() => collectNodePeople(data), [data]);
  const timing = timingTooltip(data);

  const accentStyle: ViewerAccentStyle = {
    "--vef-approval-node-accent": accent,
    "--vef-approval-node-kind": NODE_KIND_COLORS[kind]
  };

  return (
    <div
      css={nodeCardStyle}
      data-progress={data.status}
      data-reached={isReached(data.status)}
      style={accentStyle}
    >
      <NodePeopleOverlay people={people} />

      <div className="vef-approval-node-header">
        <span className="vef-approval-node-badge">
          <Icon component={KindIcon} />
        </span>

        <Tooltip title={data.name}>
          <span className="vef-approval-node-name">{data.name}</span>
        </Tooltip>
      </div>

      <Tooltip title={timing}>
        <span className="vef-approval-node-status">
          <span className="vef-approval-node-dot" />
          {NODE_PROGRESS_LABELS[data.status]}
        </span>
      </Tooltip>

      {kind !== "start" && <Handle isConnectable={false} position={Position.Left} type="target" />}
      {kind !== "end" && <Handle isConnectable={false} position={Position.Right} type="source" />}
    </div>
  );
}
