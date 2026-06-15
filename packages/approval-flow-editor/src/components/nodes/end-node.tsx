import type { NodeProps } from "@xyflow/react";

import type { EndNode as EndNodeType } from "../../types";

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import { BaseNode } from "./base-node";

export const EndNode = memo(({ data, selected }: NodeProps<EndNodeType>) => (
  <BaseNode
    description={data.description}
    label={data.name ?? "结束"}
    selected={selected}
    type="end"
  >
    <Handle position={Position.Left} type="target" />
  </BaseNode>
));

EndNode.displayName = "EndNode";
