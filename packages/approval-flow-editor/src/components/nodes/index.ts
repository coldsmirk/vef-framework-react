import type { NodeTypes } from "@xyflow/react";

import { ApprovalNode } from "./approval-node";
import { CcNode } from "./cc-node";
import { ConditionNode } from "./condition-node";
import { EndNode } from "./end-node";
import { HandleNode } from "./handle-node";
import { StartNode } from "./start-node";

export const nodeTypes: NodeTypes = {
  start: StartNode,
  approval: ApprovalNode,
  handle: HandleNode,
  condition: ConditionNode,
  cc: CcNode,
  end: EndNode
};
