import type { NodeRenderContext } from "@coldsmirk/nodeloom-core";
import type { ReactNode } from "react";

import { ApprovalNode } from "./approval-node";
import { CcNode } from "./cc-node";
import { ConditionNode } from "./condition-node";
import { EndNode } from "./end-node";
import { HandleNode } from "./handle-node";
import { StartNode } from "./start-node";

/**
 * Per-kind canvas renderers, dispatched by the engine's `renderNode` on `data.kind` (every node
 * shares the single "flowNode" xyflow type). Kinds are the closed set the editor ships; an
 * unknown kind falls through to the engine's unknown-node placeholder.
 */
const renderers = {
  start: StartNode,
  approval: ApprovalNode,
  handle: HandleNode,
  condition: ConditionNode,
  cc: CcNode,
  end: EndNode
} as const;

export function renderApprovalNode(ctx: NodeRenderContext): ReactNode {
  const Renderer = renderers[ctx.node.data.kind as keyof typeof renderers];

  return Renderer ? <Renderer {...ctx.nodeProps} /> : null;
}
