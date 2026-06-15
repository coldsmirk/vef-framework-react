import type { NodeProps } from "@xyflow/react";

import type { StartNode as StartNodeType } from "../../types";

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import { BaseNode } from "./base-node";

export const StartNode = memo(({ data, selected }: NodeProps<StartNodeType>) => (
  <BaseNode
    description={data.description}
    label={data.name ?? "开始"}
    selected={selected}
    type="start"
  >
    <Handle position={Position.Right} type="source" />
  </BaseNode>
));

StartNode.displayName = "StartNode";
