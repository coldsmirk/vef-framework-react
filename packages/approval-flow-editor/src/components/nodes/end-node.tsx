import type { NodeProps } from "@xyflow/react";

import type { FlowNode } from "../../types";

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import { dataConfig } from "../../store";
import { BaseNode } from "./base-node";

export const EndNode = memo(({ data, selected }: NodeProps<FlowNode>) => {
  const config = dataConfig(data, "end");

  return (
    <BaseNode
      description={config?.description}
      label={config?.name ?? "结束"}
      selected={selected}
      type="end"
    >
      <Handle position={Position.Left} type="target" />
    </BaseNode>
  );
});

EndNode.displayName = "EndNode";
