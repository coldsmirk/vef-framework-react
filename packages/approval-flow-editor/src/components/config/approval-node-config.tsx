import type { FC } from "react";

import type {
  AddAssigneeType,
  ApprovalMethod,
  ApprovalNodeData,
  ConsecutiveApproverAction,
  EmptyAssigneeAction,
  ExecutionType,
  FieldPermission,
  FlowNode,
  PassRule,
  RollbackDataStrategy,
  RollbackType,
  SameApplicantAction,
  TimeoutAction
} from "../../types";

import { Checkbox, Input, InputNumber, Segmented, Select } from "@vef-framework-react/components";
import { useShallow } from "@vef-framework-react/core";
import { useMemo } from "react";

import { anyNodeConfig, nodeConfig, useApprovalActions, useEditorStore, useEditorUiStore } from "../../store";
import { AssigneeList } from "./assignee-list";
import { CcList } from "./cc-list";
import { FieldPermissionTable } from "./field-permission-table";
import { PrincipalPicker } from "./principal-picker";
import { CheckboxList, ConfigSection, FormField } from "./shared";

const EXECUTION_TYPE_OPTIONS: Array<{ label: string; value: ExecutionType }> = [
  { label: "人工审批", value: "manual" },
  { label: "自动通过", value: "auto_pass" },
  { label: "自动拒绝", value: "auto_reject" }
];

const APPROVAL_METHOD_OPTIONS: Array<{ label: string; value: ApprovalMethod }> = [
  { label: "依次审批", value: "sequential" },
  { label: "并行审批", value: "parallel" }
];

const PASS_RULE_OPTIONS: Array<{ label: string; value: PassRule }> = [
  { label: "全部通过（一票否决）", value: "all" },
  { label: "任一人通过", value: "any" },
  { label: "按比例通过", value: "ratio" }
];

const EMPTY_HANDLER_OPTIONS: Array<{ label: string; value: EmptyAssigneeAction }> = [
  { label: "自动通过", value: "auto_pass" },
  { label: "转交管理员", value: "transfer_admin" },
  { label: "转交上级主管", value: "transfer_superior" },
  { label: "转交发起人", value: "transfer_applicant" },
  { label: "转交指定人员", value: "transfer_specified" }
];

const SAME_APPLICANT_OPTIONS: Array<{ label: string; value: SameApplicantAction }> = [
  { label: "自动通过", value: "auto_pass" },
  { label: "由本人审批", value: "self_approve" },
  { label: "转交上级主管", value: "transfer_superior" }
];

const DUPLICATE_HANDLER_OPTIONS: Array<{ label: string; value: ConsecutiveApproverAction }> = [
  { label: "无操作", value: "none" },
  { label: "自动通过", value: "auto_pass" }
];

const ADD_ASSIGNEE_TYPE_OPTIONS: Array<{ label: string; value: AddAssigneeType }> = [
  { label: "前加签", value: "before" },
  { label: "后加签", value: "after" },
  { label: "并行加签", value: "parallel" }
];

const ROLLBACK_TYPE_OPTIONS: Array<{ label: string; value: RollbackType }> = [
  { label: "回退上一节点", value: "previous" },
  { label: "回退发起人", value: "start" },
  { label: "回退指定节点", value: "specified" },
  { label: "回退任意节点", value: "any" }
];

const ROLLBACK_DATA_OPTIONS: Array<{ label: string; value: RollbackDataStrategy }> = [
  { label: "清除表单数据", value: "clear" },
  { label: "保留历史数据", value: "keep" }
];

const TIMEOUT_ACTION_OPTIONS: Array<{ label: string; value: TimeoutAction }> = [
  { label: "仅标记超时", value: "none" },
  { label: "自动通过", value: "auto_pass" },
  { label: "自动拒绝", value: "auto_reject" },
  { label: "仅发送通知", value: "notify" },
  { label: "转交管理员", value: "transfer_admin" }
];

const APPROVAL_FIELD_PERMISSIONS: Array<{ label: string; value: FieldPermission }> = [
  { label: "可见", value: "visible" },
  { label: "可编辑", value: "editable" },
  { label: "隐藏", value: "hidden" },
  { label: "必填", value: "required" }
];

// Hoisted stable references to prevent re-renders
const FULL_WIDTH_STYLE = { width: "100%" } as const;
const TEXT_AREA_AUTO_SIZE = { minRows: 2, maxRows: 4 } as const;
const DEFAULT_ADD_ASSIGNEE_TYPES: AddAssigneeType[] = ["before", "after", "parallel"];
// Stable empty reference so the rollback-target selector does not re-render the
// panel when this node is not in "specified" rollback mode.
const EMPTY_NODES: FlowNode[] = [];

interface ApprovalNodeConfigProps {
  nodeId: string;
}

export const ApprovalNodeConfig: FC<ApprovalNodeConfigProps> = ({ nodeId }) => {
  // Subscribe to the node's data, not the node object: dragging changes the
  // node's identity every frame while its data reference stays stable, so this
  // large form does not re-render during drags.
  const data = useEditorStore(s => nodeConfig(s.nodes.find(n => n.id === nodeId), "approval"));
  const readonly = useEditorUiStore(s => s.readonly);
  const { updateNodeData } = useApprovalActions();

  // Candidate targets for "rollback to specified node": other task nodes in the
  // flow (the backend stores their ids in rollbackTargetKeys). Subscribe to the
  // candidate node objects — and only while this node is in "specified" mode —
  // instead of the whole `nodes` array, so dragging unrelated nodes no longer
  // re-renders this large form every frame. useShallow keeps the reference
  // stable across drags that do not touch a candidate; options are then memoized.
  const rollbackCandidateNodes = useEditorStore(
    useShallow(s => {
      const self = nodeConfig(s.nodes.find(n => n.id === nodeId), "approval");

      if (self?.rollbackType !== "specified") {
        return EMPTY_NODES;
      }

      return s.nodes.filter(n => n.id !== nodeId && (n.data.kind === "approval" || n.data.kind === "handle"));
    })
  );
  const rollbackTargetOptions = useMemo(
    () => rollbackCandidateNodes.map(n => { return { label: anyNodeConfig(n)?.name ?? n.id, value: n.id }; }),
    [rollbackCandidateNodes]
  );

  if (!data) {
    return null;
  }

  const update = (partial: Partial<ApprovalNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  return (
    <>
      {/* ── Basic Info ── */}
      <ConfigSection title="基本信息">
        <FormField label="节点名称">
          <Input
            disabled={readonly}
            placeholder="请输入审批节点名称"
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

      {/* ── Approval Settings ── */}
      <ConfigSection title="审批设置">
        <FormField label="执行类型">
          <Select
            disabled={readonly}
            options={EXECUTION_TYPE_OPTIONS}
            style={FULL_WIDTH_STYLE}
            value={data.executionType ?? "manual"}
            onChange={value => update({ executionType: value })}
          />
        </FormField>

        <FormField label="审批方式">
          <Segmented
            block
            disabled={readonly}
            options={APPROVAL_METHOD_OPTIONS}
            value={data.approvalMethod ?? "parallel"}
            onChange={(value: string | number) => {
              // Dependent fields (passRule / passRatio) are retained, not
              // cleared — the uniform policy across this panel: hidden config
              // survives toggling so the user never loses work, and the backend
              // reads only the fields relevant to the selected method.
              if (value === "sequential" || value === "parallel") {
                update({ approvalMethod: value });
              }
            }}
          />
        </FormField>

        {data.approvalMethod === "parallel" && (
          <>
            <FormField label="通过规则">
              <Select
                disabled={readonly}
                options={PASS_RULE_OPTIONS}
                style={FULL_WIDTH_STYLE}
                value={data.passRule ?? "all"}
                onChange={value => update({ passRule: value })}
              />
            </FormField>

            {data.passRule === "ratio" && (
              <FormField label="通过比例 (%)">
                <InputNumber
                  disabled={readonly}
                  max={100}
                  min={1}
                  style={FULL_WIDTH_STYLE}
                  value={data.passRatio ?? 100}
                  onChange={value => update({ passRatio: value ?? 100 })}
                />
              </FormField>
            )}
          </>
        )}
      </ConfigSection>

      {/* ── Assignees ── */}
      <ConfigSection title="审批人">
        <AssigneeList
          disabled={readonly}
          value={data.assignees ?? []}
          onChange={assignees => update({ assignees })}
        />
      </ConfigSection>

      {/* ── Personnel Settings ── */}
      <ConfigSection title="人员设置">
        <FormField label="无审批人时">
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

        <FormField label="审批人与发起人相同">
          <Select
            disabled={readonly}
            options={SAME_APPLICANT_OPTIONS}
            style={FULL_WIDTH_STYLE}
            value={data.sameApplicantAction ?? "self_approve"}
            onChange={value => update({ sameApplicantAction: value })}
          />
        </FormField>

        <FormField label="重复审批人">
          <Select
            disabled={readonly}
            options={DUPLICATE_HANDLER_OPTIONS}
            style={FULL_WIDTH_STYLE}
            value={data.consecutiveApproverAction ?? "none"}
            onChange={value => update({ consecutiveApproverAction: value })}
          />
        </FormField>
      </ConfigSection>

      {/* ── CCs ── */}
      <ConfigSection title="抄送人">
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
            checked={data.isRollbackAllowed ?? true}
            disabled={readonly}
            onChange={event => update({ isRollbackAllowed: event.target.checked })}
          >
            允许回退
          </Checkbox>

          {(data.isRollbackAllowed ?? true) && (
            <>
              <FormField label="回退类型">
                <Select
                  disabled={readonly}
                  options={ROLLBACK_TYPE_OPTIONS}
                  style={FULL_WIDTH_STYLE}
                  value={data.rollbackType ?? "previous"}
                  onChange={value => update({ rollbackType: value })}
                />
              </FormField>

              <FormField label="回退数据策略">
                <Select
                  disabled={readonly}
                  options={ROLLBACK_DATA_OPTIONS}
                  style={FULL_WIDTH_STYLE}
                  value={data.rollbackDataStrategy ?? "keep"}
                  onChange={value => update({ rollbackDataStrategy: value })}
                />
              </FormField>

              {data.rollbackType === "specified" && (
                <FormField label="回退目标节点">
                  <Select
                    disabled={readonly}
                    mode="multiple"
                    options={rollbackTargetOptions}
                    placeholder="选择可回退到的节点"
                    style={FULL_WIDTH_STYLE}
                    value={data.rollbackTargetKeys ?? []}
                    onChange={(value: string[]) => update({ rollbackTargetKeys: value })}
                  />
                </FormField>
              )}
            </>
          )}

          <Checkbox
            checked={data.isTransferAllowed ?? true}
            disabled={readonly}
            onChange={event => update({ isTransferAllowed: event.target.checked })}
          >
            允许转办
          </Checkbox>

          <Checkbox
            checked={data.isAddAssigneeAllowed ?? true}
            disabled={readonly}
            onChange={event => update({ isAddAssigneeAllowed: event.target.checked })}
          >
            允许加签
          </Checkbox>

          {(data.isAddAssigneeAllowed ?? true) && (
            <FormField label="加签类型">
              <Checkbox.Group
                disabled={readonly}
                options={ADD_ASSIGNEE_TYPE_OPTIONS}
                value={data.addAssigneeTypes ?? DEFAULT_ADD_ASSIGNEE_TYPES}
                onChange={values => update({ addAssigneeTypes: values })}
              />
            </FormField>
          )}

          <Checkbox
            checked={data.isRemoveAssigneeAllowed ?? true}
            disabled={readonly}
            onChange={event => update({ isRemoveAssigneeAllowed: event.target.checked })}
          >
            允许减签
          </Checkbox>

          <Checkbox
            checked={data.isManualCcAllowed ?? true}
            disabled={readonly}
            onChange={event => update({ isManualCcAllowed: event.target.checked })}
          >
            允许手动抄送
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
          permissions={APPROVAL_FIELD_PERMISSIONS}
          value={data.fieldPermissions ?? {}}
          onChange={fieldPermissions => update({ fieldPermissions })}
        />
      </ConfigSection>
    </>
  );
};
