import type { FC } from "react";

import type { CcFieldPermission, CcNodeData } from "../../types";

import { Checkbox, Input } from "@vef-framework-react/components";

import { nodeConfig, useApprovalActions, useEditorStore, useEditorUiStore } from "../../store";
import { CcList } from "./cc-list";
import { FieldPermissionTable } from "./field-permission-table";
import { CheckboxList, ConfigSection, FormField } from "./shared";

const TEXT_AREA_AUTO_SIZE = { minRows: 2, maxRows: 4 } as const;

const CC_FIELD_PERMISSIONS: Array<{ label: string; value: CcFieldPermission }> = [
  { label: "可见", value: "visible" },
  { label: "隐藏", value: "hidden" }
];

interface CcNodeConfigProps {
  nodeId: string;
}

export const CcNodeConfig: FC<CcNodeConfigProps> = ({ nodeId }) => {
  // Subscribe to the node's data, not the node object: dragging changes the
  // node's identity every frame while its data reference stays stable, so the
  // form does not re-render during drags.
  const data = useEditorStore(s => nodeConfig(s.nodes.find(n => n.id === nodeId), "cc"));
  const readonly = useEditorUiStore(s => s.readonly);
  const { updateNodeData } = useApprovalActions();

  if (!data) {
    return null;
  }

  const update = (partial: Partial<CcNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  return (
    <>
      {/* ── Basic Info ── */}
      <ConfigSection title="基本信息">
        <FormField label="节点名称">
          <Input
            disabled={readonly}
            placeholder="请输入抄送节点名称"
            value={data.name ?? ""}
            onChange={event => update({ name: event.currentTarget.value })}
          />
        </FormField>

        <FormField label="节点描述">
          <Input.TextArea
            autoSize={TEXT_AREA_AUTO_SIZE}
            disabled={readonly}
            placeholder="可选的节点描述"
            value={data.description ?? ""}
            onChange={event => update({ description: event.currentTarget.value })}
          />
        </FormField>
      </ConfigSection>

      {/* ── CC Recipients ── */}
      <ConfigSection title="抄送人">
        <CcList
          showTiming
          disabled={readonly}
          value={data.ccs ?? []}
          onChange={ccs => update({ ccs })}
        />
      </ConfigSection>

      {/* ── CC Settings ── */}
      <ConfigSection title="抄送设置">
        <CheckboxList>
          <Checkbox
            checked={data.isReadConfirmRequired ?? false}
            disabled={readonly}
            onChange={event => update({ isReadConfirmRequired: event.target.checked })}
          >
            等待全员已阅后继续
          </Checkbox>
        </CheckboxList>
      </ConfigSection>

      {/* ── Field Permissions ── */}
      <ConfigSection defaultOpen={false} title="表单权限">
        <FieldPermissionTable
          disabled={readonly}
          permissions={CC_FIELD_PERMISSIONS}
          value={data.fieldPermissions ?? {}}
          onChange={fieldPermissions => update({ fieldPermissions })}
        />
      </ConfigSection>
    </>
  );
};
