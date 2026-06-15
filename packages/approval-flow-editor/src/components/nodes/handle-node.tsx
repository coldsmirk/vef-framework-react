import type { NodeProps } from "@xyflow/react";

import type { HandleNode as HandleNodeType } from "../../types";

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import { BaseNode } from "./base-node";

export const HandleNode = memo(({ data, selected }: NodeProps<HandleNodeType>) => (
  <BaseNode
    description={data.description}
    label={data.name ?? "办理节点"}
    selected={selected}
    type="handle"
  >
    <Handle position={Position.Left} type="target" />
    <Handle position={Position.Right} type="source" />
  </BaseNode>
));

HandleNode.displayName = "HandleNode";
