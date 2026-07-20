import type { NodeProps } from "@xyflow/react";

import type { CcNode as CcNodeType } from "../../types";

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import { BaseNode } from "./base-node";

export const CcNode = memo(({ data, selected }: NodeProps<CcNodeType>) => (
  <BaseNode
    description={data.description}
    label={data.name ?? "抄送节点"}
    selected={selected}
    type="cc"
  >
    <Handle position={Position.Left} type="target" />
    <Handle position={Position.Right} type="source" />
  </BaseNode>
));

CcNode.displayName = "CcNode";
