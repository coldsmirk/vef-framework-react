import type { FC } from "react";

import { Input } from "@vef-framework-react/components";

import { useEditorStore } from "../../store";
import { ConfigSection, FormField } from "./shared";

const TEXT_AREA_AUTO_SIZE = { minRows: 2, maxRows: 4 } as const;

/**
 * Basic info config for start/end nodes
 */
export const BasicNodeConfig: FC<{ nodeId: string }> = ({ nodeId }) => {
  // Subscribe to the node's data, not the node object: dragging changes the
  // node's identity every frame while its data reference stays stable, so the
  // form does not re-render during drags.
  const data = useEditorStore(s => s.nodes.find(n => n.id === nodeId)?.data);
  const readonly = useEditorStore(s => s.readonly);
  const updateNodeData = useEditorStore(s => s.updateNodeData);

  if (!data) {
    return null;
  }

  return (
    <ConfigSection title="基本信息">
      <FormField label="节点名称">
        <Input
          disabled={readonly}
          placeholder="请输入节点名称"
          value={data.name ?? ""}
          onChange={event => updateNodeData(nodeId, { name: event.currentTarget.value })}
        />
      </FormField>

      <FormField label="节点描述">
        <Input.TextArea
          autoSize={TEXT_AREA_AUTO_SIZE}
          disabled={readonly}
          placeholder="可选的节点描述"
          value={data.description ?? ""}
          onChange={event => updateNodeData(nodeId, { description: event.currentTarget.value })}
        />
      </FormField>
    </ConfigSection>
  );
};
