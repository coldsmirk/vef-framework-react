import type { NodeProps } from "@xyflow/react";

import type { FlowNode } from "../../types";

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import { dataConfig } from "../../store";
import { BaseNode } from "./base-node";

export const HandleNode = memo(({ data, selected }: NodeProps<FlowNode>) => {
  const config = dataConfig(data, "handle");

  return (
    <BaseNode
      description={config?.description}
      label={config?.name ?? "办理节点"}
      selected={selected}
      type="handle"
    >
      <Handle position={Position.Left} type="target" />
      <Handle position={Position.Right} type="source" />
    </BaseNode>
  );
});

HandleNode.displayName = "HandleNode";
