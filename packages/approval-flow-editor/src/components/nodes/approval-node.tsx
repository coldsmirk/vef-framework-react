import type { NodeProps } from "@xyflow/react";

import type { ApprovalNode as ApprovalNodeType } from "../../types";

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import { BaseNode } from "./base-node";

export const ApprovalNode = memo(({ data, selected }: NodeProps<ApprovalNodeType>) => (
  <BaseNode
    description={data.description}
    label={data.name ?? "审批节点"}
    selected={selected}
    type="approval"
  >
    <Handle position={Position.Left} type="target" />
    <Handle position={Position.Right} type="source" />
  </BaseNode>
));

ApprovalNode.displayName = "ApprovalNode";
