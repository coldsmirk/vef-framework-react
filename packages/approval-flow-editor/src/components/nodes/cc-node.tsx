import type { NodeProps } from "@xyflow/react";

import type { FlowNode } from "../../types";

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import { dataConfig } from "../../store";
import { BaseNode } from "./base-node";

export const CcNode = memo(({ data, selected }: NodeProps<FlowNode>) => {
  const config = dataConfig(data, "cc");

  return (
    <BaseNode
      description={config?.description}
      label={config?.name ?? "抄送节点"}
      selected={selected}
      type="cc"
    >
      <Handle position={Position.Left} type="target" />
      <Handle position={Position.Right} type="source" />
    </BaseNode>
  );
});

CcNode.displayName = "CcNode";
