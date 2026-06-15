import type { DataOption } from "@vef-framework-react/core";
import type { FC } from "react";

import type { ConditionDefinition, ConditionGroup } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input, Modal, Segmented, showConfirm } from "@vef-framework-react/components";
import { PlusIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { useRowKeys } from "../../hooks/use-row-keys";
import { ConditionRuleItem } from "./condition-rule-item";

const MODE_OPTIONS: DataOption[] = [
  { label: "可视化", value: "visual" },
  { label: "表达式", value: "expression" }
];

type EditorMode = "visual" | "expression";

const modalBodyStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: 10,
  maxHeight: "60vh",
  overflow: "auto",
  padding: globalCssVars.spacingXs
});

const segmentedWrapperStyle = css({
  display: "flex",
  justifyContent: "center",
  paddingBottom: 10,
  flexShrink: 0
});

const groupCardStyle = css({
  borderRadius: globalCssVars.borderRadiusLg,
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: globalCssVars.colorFillQuaternary,
  borderLeft: `3px solid ${globalCssVars.colorPrimary}`
});

const andDividerStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  "& > span": {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.05em",
    color: globalCssVars.colorTextQuaternary,
    background: globalCssVars.colorFillTertiary,
    borderRadius: 4,
    padding: "1px 8px",
    lineHeight: "18px"
  }
});

const orDividerStyle = css({
  display: "flex",
  alignItems: "center",
  gap: 10,

  "&::before, &::after": {
    content: "\"\"",
    flex: 1,
    height: 1,
    background: globalCssVars.colorBorderSecondary
  },

  "& > span": {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.05em",
    color: globalCssVars.colorWarningText,
    background: globalCssVars.colorWarningBg,
    borderRadius: 4,
    padding: "1px 10px",
    lineHeight: "18px"
  }
});

const addConditionButtonStyle = css({
  height: 28,
  fontSize: 12
});

const addGroupButtonStyle = css({
  height: 32,
  flexShrink: 0
});

const expressionHintStyle = css({
  fontSize: 12,
  color: globalCssVars.colorTextTertiary
});

const emptyHintStyle = css({
  textAlign: "center",
  color: globalCssVars.colorTextQuaternary,
  fontSize: 13,
  padding: "16px 0"
});

const EMPTY_CONDITION: ConditionDefinition = {
  kind: "field",
  subject: "",
  operator: "",
  value: undefined,
  expression: ""
};

interface ConditionEditorModalProps {
  open: boolean;
  conditionGroups: ConditionGroup[];
  readonly: boolean;
  onOk: (conditionGroups: ConditionGroup[]) => void;
  onCancel: () => void;
}

function detectMode(groups: ConditionGroup[]): EditorMode {
  const [firstGroup] = groups;

  if (
    groups.length === 1
    && firstGroup
    && firstGroup.conditions.length === 1
    && firstGroup.conditions[0]?.kind === "expression"
  ) {
    return "expression";
  }

  return "visual";
}

interface ConditionGroupCardProps {
  group: ConditionGroup;
  readonly: boolean;
  onAddCondition: () => void;
  onRemoveCondition: (condIdx: number) => void;
  onUpdateCondition: (condIdx: number, condition: ConditionDefinition) => void;
}

/**
 * One AND-group card. A dedicated component (not inline JSX in the modal) so
 * each group owns row keys for its conditions: rows are removable mid-list,
 * and index keys would leak a removed row's antd Select transient state into
 * its successor (see useRowKeys).
 */
const ConditionGroupCard: FC<ConditionGroupCardProps> = ({
  group,
  readonly,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition
}) => {
  const rowKeys = useRowKeys(group.conditions.length);

  return (
    <div css={groupCardStyle}>
      {group.conditions.map((cond, ci) => (
        <Fragment key={rowKeys.keys[ci]}>
          {ci > 0 && (
            <div css={andDividerStyle}>
              <span>AND</span>
            </div>
          )}

          <ConditionRuleItem
            condition={cond}
            readonly={readonly}
            onChange={condition => onUpdateCondition(ci, condition)}
            onRemove={() => {
              rowKeys.remove(ci);
              onRemoveCondition(ci);
            }}
          />
        </Fragment>
      ))}

      {!readonly && (
        <Button
          block
          css={addConditionButtonStyle}
          icon={<PlusIcon size={12} />}
          size="small"
          type="dashed"
          onClick={onAddCondition}
        >
          添加条件
        </Button>
      )}
    </div>
  );
};

export const ConditionEditorModal: FC<ConditionEditorModalProps> = ({
  open,
  conditionGroups,
  readonly,
  onOk,
  onCancel
}) => {
  const [groups, setGroups] = useState<ConditionGroup[]>([]);
  const [mode, setMode] = useState<EditorMode>("visual");
  const [expressionText, setExpressionText] = useState("");
  // Stable keys for the (removable) group cards; each card tracks its own
  // condition row keys internally.
  const groupKeys = useRowKeys(groups.length);

  // Seed the draft state only on the closed -> open transition. Depending on
  // `conditionGroups` would re-seed (wiping in-progress edits) on every parent
  // re-render, because the parent passes a fresh `?? []` array identity each
  // time. The latest groups are read from a ref, so there is no stale closure.
  const conditionGroupsRef = useRef(conditionGroups);
  conditionGroupsRef.current = conditionGroups;
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const seed = conditionGroupsRef.current;
      setGroups(seed);
      const detected = detectMode(seed);
      setMode(detected);

      if (detected === "expression" && seed.length === 1 && seed[0]) {
        setExpressionText(seed[0].conditions[0]?.expression ?? "");
      } else {
        setExpressionText("");
      }
    }

    prevOpenRef.current = open;
  }, [open]);

  const handleModeChange = (nextMode: string | number) => {
    if (nextMode !== "visual" && nextMode !== "expression") {
      return;
    }

    const hasData = mode === "visual"
      ? groups.some(g => g.conditions.length > 0)
      : expressionText.trim().length > 0;

    const applySwitch = () => {
      setMode(nextMode);
      setGroups([]);
      setExpressionText("");
    };

    if (hasData) {
      showConfirm("切换将清空当前条件，是否继续？", {
        title: "切换模式",
        onOk: applySwitch
      });
    } else {
      applySwitch();
    }
  };

  const updateCondition = (groupIdx: number, condIdx: number, condition: ConditionDefinition) => {
    setGroups(prev => prev.map((g, gi) => gi === groupIdx
      ? { ...g, conditions: g.conditions.map((c, ci) => ci === condIdx ? condition : c) }
      : g));
  };

  const removeCondition = (groupIdx: number, condIdx: number) => {
    // A group is pruned together with its last condition — retire its row key
    // alongside so the surviving groups keep their keys.
    if (groups[groupIdx]?.conditions.length === 1) {
      groupKeys.remove(groupIdx);
    }

    setGroups(prev => {
      const next = prev.map((g, gi) => gi === groupIdx
        ? { ...g, conditions: g.conditions.filter((_, ci) => ci !== condIdx) }
        : g);
      // Remove empty groups
      return next.filter(g => g.conditions.length > 0);
    });
  };

  const addCondition = (groupIdx: number) => {
    setGroups(prev => prev.map((g, gi) => gi === groupIdx
      ? { ...g, conditions: [...g.conditions, { ...EMPTY_CONDITION }] }
      : g));
  };

  const addGroup = () => {
    setGroups(prev => [...prev, { conditions: [{ ...EMPTY_CONDITION }] }]);
  };

  const handleOk = () => {
    if (mode === "expression") {
      const trimmed = expressionText.trim();
      onOk(trimmed
        ? [
            {
              conditions: [
                {
                  ...EMPTY_CONDITION,
                  kind: "expression",
                  expression: trimmed
                }
              ]
            }
          ]
        : []);
    } else {
      const cleaned = groups
        .map(group => { return { ...group, conditions: group.conditions.filter(c => c.subject || c.expression) }; })
        .filter(group => group.conditions.length > 0);
      onOk(cleaned);
    }
  };

  return (
    <Modal
      open={open}
      title="编辑条件"
      width={600}
      footer={readonly
        ? <Button onClick={onCancel}>关闭</Button>
        : (
            <>
              <Button onClick={onCancel}>取消</Button>
              <Button type="primary" onClick={handleOk}>确定</Button>
            </>
          )}
      onCancel={onCancel}
    >
      <div css={modalBodyStyle}>
        <div css={segmentedWrapperStyle}>
          <Segmented
            options={MODE_OPTIONS}
            value={mode}
            onChange={handleModeChange}
          />
        </div>

        {mode === "visual"
          ? (
              <>
                {groups.length === 0 && !readonly && (
                  <div css={emptyHintStyle}>
                    点击下方按钮添加条件组
                  </div>
                )}

                {groups.map((group, gi) => (
                  <Fragment key={groupKeys.keys[gi]}>
                    {gi > 0 && (
                      <div css={orDividerStyle}>
                        <span>OR</span>
                      </div>
                    )}

                    <ConditionGroupCard
                      group={group}
                      readonly={readonly}
                      onAddCondition={() => addCondition(gi)}
                      onRemoveCondition={ci => removeCondition(gi, ci)}
                      onUpdateCondition={(ci, condition) => updateCondition(gi, ci, condition)}
                    />
                  </Fragment>
                ))}

                {!readonly && (
                  <Button
                    block
                    css={addGroupButtonStyle}
                    icon={<PlusIcon size={14} />}
                    type="dashed"
                    onClick={addGroup}
                  >
                    添加条件组
                  </Button>
                )}
              </>
            )
          : (
              <>
                <Input.TextArea
                  autoSize={{ maxRows: 10, minRows: 4 }}
                  placeholder="请输入条件表达式"
                  readOnly={readonly}
                  value={expressionText}
                  onChange={event => setExpressionText(event.target.value)}
                />

                <div css={expressionHintStyle}>
                  可用变量: formData.字段key、applicantId、applicantDepartmentId；支持 and / or / not 组合，例如 formData.amount &gt; 1000 and applicantDepartmentId == "dept-1"
                </div>
              </>
            )}
      </div>
    </Modal>
  );
};
