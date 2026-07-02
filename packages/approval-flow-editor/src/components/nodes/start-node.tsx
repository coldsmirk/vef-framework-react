import type { NodeProps } from "@xyflow/react";

import type { FlowNode } from "../../types";

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import { dataConfig } from "../../store";
import { BaseNode } from "./base-node";

export const StartNode = memo(({ data, selected }: NodeProps<FlowNode>) => {
  const config = dataConfig(data, "start");

  return (
    <BaseNode
      description={config?.description}
      label={config?.name ?? "开始"}
      selected={selected}
      type="start"
    >
      <Handle position={Position.Right} type="source" />
    </BaseNode>
  );
});

StartNode.displayName = "StartNode";
