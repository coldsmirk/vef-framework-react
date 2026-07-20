import type { FC } from "react";

import type { EmptyAssigneeAction, ExecutionType, FieldPermission, HandleNodeData, TimeoutAction } from "../../types";

import { Checkbox, Input, InputNumber, Select } from "@vef-framework-react/components";

import { useEditorStore } from "../../store";
import { AssigneeList } from "./assignee-list";
import { CcList } from "./cc-list";
import { FieldPermissionTable } from "./field-permission-table";
import { PrincipalPicker } from "./principal-picker";
import { CheckboxList, ConfigSection, FormField } from "./shared";

// Handle nodes perform work rather than decide, so auto_reject is excluded
// from both execution and timeout options — backend deploy validation
// enforces the same restriction.
const EXECUTION_TYPE_OPTIONS: Array<{ label: string; value: ExecutionType }> = [
  { label: "人工办理", value: "manual" },
  { label: "自动通过", value: "auto_pass" }
];

const EMPTY_HANDLER_OPTIONS: Array<{ label: string; value: EmptyAssigneeAction }> = [
  { label: "自动通过", value: "auto_pass" },
  { label: "转交管理员", value: "transfer_admin" },
  { label: "转交上级主管", value: "transfer_superior" },
  { label: "转交发起人", value: "transfer_applicant" },
  { label: "转交指定人员", value: "transfer_specified" }
];

const TIMEOUT_ACTION_OPTIONS: Array<{ label: string; value: TimeoutAction }> = [
  { label: "仅标记超时", value: "none" },
  { label: "自动办结", value: "auto_pass" },
  { label: "仅发送通知", value: "notify" },
  { label: "转交管理员", value: "transfer_admin" }
];

const HANDLE_FIELD_PERMISSIONS: Array<{ label: string; value: FieldPermission }> = [
  { label: "可见", value: "visible" },
  { label: "可编辑", value: "editable" },
  { label: "隐藏", value: "hidden" },
  { label: "必填", value: "required" }
];

// Hoisted stable references to prevent re-renders
const FULL_WIDTH_STYLE = { width: "100%" } as const;
const TEXT_AREA_AUTO_SIZE = { minRows: 2, maxRows: 4 } as const;

interface HandleNodeConfigProps {
  nodeId: string;
}

export const HandleNodeConfig: FC<HandleNodeConfigProps> = ({ nodeId }) => {
  // Subscribe to the node's data, not the node object: dragging changes the
  // node's identity every frame while its data reference stays stable, so the
  // form does not re-render during drags.
  const data = useEditorStore(s => {
    const node = s.nodes.find(n => n.id === nodeId);
    return node?.type === "handle" ? node.data : undefined;
  });
  const readonly = useEditorStore(s => s.readonly);
  const updateNodeData = useEditorStore(s => s.updateNodeData);

  if (!data) {
    return null;
  }

  const update = (partial: Partial<HandleNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  return (
    <>
      {/* ── Basic Info ── */}
      <ConfigSection title="基本信息">
        <FormField label="节点名称">
          <Input
            disabled={readonly}
            placeholder="请输入办理节点名称"
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

      {/* ── Handle Settings ── */}
      <ConfigSection title="办理设置">
        <FormField label="执行类型">
          <Select
            disabled={readonly}
            options={EXECUTION_TYPE_OPTIONS}
            style={FULL_WIDTH_STYLE}
            value={data.executionType ?? "manual"}
            onChange={value => update({ executionType: value })}
          />
        </FormField>
      </ConfigSection>

      {/* ── Assignees ── */}
      <ConfigSection title="办理人">
        <AssigneeList
          disabled={readonly}
          value={data.assignees ?? []}
          onChange={assignees => update({ assignees })}
        />
      </ConfigSection>

      {/* ── Personnel Settings ── */}
      <ConfigSection title="人员设置">
        <FormField label="无办理人时">
          <Select
            disabled={readonly}
            options={EMPTY_HANDLER_OPTIONS}
            style={FULL_WIDTH_STYLE}
            value={data.emptyAssigneeAction ?? "auto_pass"}
            onChange={value => update({ emptyAssigneeAction: value })}
          />
        </FormField>

        {data.emptyAssigneeAction === "transfer_specified" && (
          <FormField label="指定转交人">
            <PrincipalPicker
              disabled={readonly}
              kind="user"
              value={data.fallbackUserIds ?? []}
              onChange={ids => update({ fallbackUserIds: ids })}
            />
          </FormField>
        )}

        {data.emptyAssigneeAction === "transfer_admin" && (
          <FormField label="节点管理员">
            <PrincipalPicker
              disabled={readonly}
              kind="user"
              value={data.adminUserIds ?? []}
              onChange={ids => update({ adminUserIds: ids })}
            />
          </FormField>
        )}
      </ConfigSection>

      {/* ── CC Settings ── */}
      <ConfigSection title="抄送设置">
        <CcList
          showTiming
          disabled={readonly}
          value={data.ccs ?? []}
          onChange={ccs => update({ ccs })}
        />
      </ConfigSection>

      {/* ── Permissions ── */}
      <ConfigSection title="权限配置">
        <CheckboxList>
          <Checkbox
            checked={data.isTransferAllowed ?? true}
            disabled={readonly}
            onChange={event => update({ isTransferAllowed: event.target.checked })}
          >
            允许转办
          </Checkbox>

          <Checkbox
            checked={data.isOpinionRequired ?? false}
            disabled={readonly}
            onChange={event => update({ isOpinionRequired: event.target.checked })}
          >
            意见必填
          </Checkbox>
        </CheckboxList>
      </ConfigSection>

      {/* ── Timeout ── */}
      <ConfigSection defaultOpen={false} title="超时设置">
        <FormField label="超时时间(小时)">
          <InputNumber
            disabled={readonly}
            min={0}
            placeholder="0 表示不限时"
            precision={0}
            style={FULL_WIDTH_STYLE}
            value={data.timeoutHours ?? 0}
            onChange={value => update({ timeoutHours: value ?? 0 })}
          />
        </FormField>

        {(data.timeoutHours ?? 0) > 0 && (
          <>
            <FormField label="超时处理">
              <Select
                disabled={readonly}
                options={TIMEOUT_ACTION_OPTIONS}
                style={FULL_WIDTH_STYLE}
                value={data.timeoutAction ?? "none"}
                onChange={value => update({ timeoutAction: value })}
              />
            </FormField>

            <FormField label="提前提醒(小时)">
              <InputNumber
                disabled={readonly}
                min={0}
                precision={0}
                style={FULL_WIDTH_STYLE}
                value={data.timeoutNotifyBeforeHours ?? 0}
                onChange={value => update({ timeoutNotifyBeforeHours: value ?? 0 })}
              />
            </FormField>

            <FormField label="催办冷却(分钟)">
              <InputNumber
                disabled={readonly}
                min={0}
                placeholder="0 表示使用默认值 30 分钟"
                precision={0}
                style={FULL_WIDTH_STYLE}
                value={data.urgeCooldownMinutes ?? 0}
                onChange={value => update({ urgeCooldownMinutes: value ?? 0 })}
              />
            </FormField>
          </>
        )}
      </ConfigSection>

      {/* ── Field Permissions ── */}
      <ConfigSection defaultOpen={false} title="表单权限">
        <FieldPermissionTable
          disabled={readonly}
          permissions={HANDLE_FIELD_PERMISSIONS}
          value={data.fieldPermissions ?? {}}
          onChange={fieldPermissions => update({ fieldPermissions })}
        />
      </ConfigSection>
    </>
  );
};
