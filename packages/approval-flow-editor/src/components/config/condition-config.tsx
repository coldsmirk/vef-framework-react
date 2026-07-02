import type { FC } from "react";

import type { ConditionGroup } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input, InputNumber, Tooltip } from "@vef-framework-react/components";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { nodeConfig, useApprovalActions, useEditorStore, useEditorUiStore } from "../../store";
import { ConditionEditorModal } from "./condition-editor-modal";
import { ConfigSection, FormField } from "./shared";

const branchListStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: 8
});

const branchItemStyle = css({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  background: globalCssVars.colorFillQuaternary,
  borderRadius: globalCssVars.borderRadius
});

const branchIndexStyle = css({
  width: 20,
  height: 20,
  borderRadius: "50%",
  background: globalCssVars.colorFillTertiary,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  color: globalCssVars.colorTextTertiary,
  flexShrink: 0
});

const branchFieldsStyle = css({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4
});

const branchDefaultStyle = css({
  fontSize: 10,
  color: globalCssVars.colorTextQuaternary,
  background: globalCssVars.colorFillTertiary,
  padding: "1px 6px",
  borderRadius: 3,
  flexShrink: 0
});

const branchDeleteStyle = css({
  flexShrink: 0
});

const priorityGroupStyle = css({
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexShrink: 0
});

const priorityLabelStyle = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  whiteSpace: "nowrap"
});

const TEXT_AREA_AUTO_SIZE = { minRows: 2, maxRows: 4 } as const;
const PRIORITY_INPUT_STYLE = { width: 56 } as const;

interface ConditionConfigProps {
  nodeId: string;
}

const conditionSummaryStyle = css({
  fontSize: 12,
  color: globalCssVars.colorTextTertiary
});

const conditionEditRowStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
});

function getConditionSummary(groups?: ConditionGroup[]): string {
  if (!groups || groups.length === 0) {
    return "未设置";
  }

  const hasExpression = groups.some(g => g.conditions.some(c => c.kind === "expression"));

  if (hasExpression) {
    return "表达式条件";
  }

  return `${groups.length} 组条件`;
}

export const ConditionConfig: FC<ConditionConfigProps> = ({ nodeId }) => {
  // Subscribe to the node's data, not the node object: dragging changes the
  // node's identity every frame while its data reference stays stable, so the
  // form does not re-render during drags.
  const data = useEditorStore(s => nodeConfig(s.nodes.find(n => n.id === nodeId), "condition"));
  const readonly = useEditorUiStore(s => s.readonly);
  const { updateNodeData } = useApprovalActions();
  const {
    updateConditionBranch,
    addConditionBranch,
    removeConditionBranch
  } = useApprovalActions();
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

  if (!data) {
    return null;
  }

  const branches = data.branches ?? [];
  const nonDefaultCount = branches.filter(b => !b.isDefault).length;

  return (
    <>
      {/* ── Basic Info ── */}
      <ConfigSection title="基本信息">
        <FormField label="节点名称">
          <Input
            disabled={readonly}
            placeholder="请输入条件节点名称"
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

      {/* ── Branches ── */}
      <ConfigSection title="条件分支">
        <div css={branchListStyle}>
          {branches.map((branch, index) => (
            <div key={branch.id} css={branchItemStyle}>
              <div css={branchIndexStyle}>{index + 1}</div>

              <div css={branchFieldsStyle}>
                <Input
                  disabled={readonly || branch.isDefault}
                  placeholder="分支名称"
                  value={branch.label}
                  onChange={event => updateConditionBranch(nodeId, branch.id, { label: event.currentTarget.value })}
                />

                {!branch.isDefault && (
                  <div css={conditionEditRowStyle}>
                    <span css={conditionSummaryStyle}>
                      {getConditionSummary(branch.conditionGroups)}
                    </span>

                    <Button
                      disabled={readonly}
                      size="small"
                      type="link"
                      onClick={() => setEditingBranchId(branch.id)}
                    >
                      编辑条件
                    </Button>
                  </div>
                )}
              </div>

              {branch.isDefault
                ? <span css={branchDefaultStyle}>默认</span>
                : (
                    <>
                      <Tooltip title="数字越小越先匹配，不可重复；不满足任何条件时走默认分支">
                        <div css={priorityGroupStyle}>
                          <span css={priorityLabelStyle}>优先级</span>

                          <InputNumber
                            aria-label="分支优先级"
                            disabled={readonly}
                            min={1}
                            precision={0}
                            style={PRIORITY_INPUT_STYLE}
                            value={branch.priority}
                            onChange={value => {
                              // A cleared input stays on the stored value
                              // (controlled snap-back) instead of silently
                              // rewriting the priority to 1.
                              if (value !== null && value !== undefined) {
                                updateConditionBranch(nodeId, branch.id, { priority: value });
                              }
                            }}
                          />
                        </div>
                      </Tooltip>

                      <div css={branchDeleteStyle}>
                        <Button
                          danger
                          aria-label="删除分支"
                          disabled={readonly || nonDefaultCount <= 1}
                          icon={<Trash2Icon size={14} />}
                          size="small"
                          type="text"
                          onClick={() => removeConditionBranch(nodeId, branch.id)}
                        />
                      </div>
                    </>
                  )}
            </div>
          ))}
        </div>

        {!readonly && (
          <Button
            block
            type="dashed"
            onClick={() => addConditionBranch(nodeId)}
          >
            添加条件分支
          </Button>
        )}
      </ConfigSection>

      <ConditionEditorModal
        open={editingBranchId !== null}
        readonly={readonly}
        conditionGroups={
          branches.find(branch => branch.id === editingBranchId)?.conditionGroups ?? []
        }
        onCancel={() => setEditingBranchId(null)}
        onOk={conditionGroups => {
          if (editingBranchId) {
            updateConditionBranch(nodeId, editingBranchId, { conditionGroups });
          }

          setEditingBranchId(null);
        }}
      />
    </>
  );
};
