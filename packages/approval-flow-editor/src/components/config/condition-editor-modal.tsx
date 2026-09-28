import type { DataOption } from "@vef-framework-react/core";
import type { FC } from "react";

import type { ConditionDefinition, ConditionGroup } from "../../types";

import { css } from "@emotion/react";
import { Button, CodeEditor, globalCssVars, Modal, Segmented, showConfirm } from "@vef-framework-react/components";
import { PlusIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { useRowKeys } from "../../hooks/use-row-keys";
import { useEditorPlugins } from "../../plugins";
import { ConditionRuleItem } from "./condition-rule-item";

const MODE_OPTIONS: DataOption[] = [
  { label: "可视化", value: "visual" },
  { label: "表达式", value: "expression" }
];

type EditorMode = "visual" | "expression";

// Wide enough for the widest rule (subject · aggregate · column · operator ·
// value) to stay on one row. antd caps a modal at the viewport width minus its
// margins, so on a narrow screen the rows shrink proportionally instead.
const MODAL_WIDTH = 880;

// The expression is the Go engine's own syntax — no CodeMirror language pack
// can highlight it, and completion would only offer JS noise, so both stay off.
const EXPRESSION_EDITOR_SETUP = { autocompletion: false } as const;

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

const footerStyle = css({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 12
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

/**
 * The editor mode a stored condition set opens in: a lone expression condition
 * is the expression mode's shape; everything else — mixed groups included — is
 * edited visually.
 */
export function detectMode(groups: ConditionGroup[]): EditorMode {
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

interface ConditionEditorContentProps {
  conditionGroups: ConditionGroup[];
  readonly: boolean;
  onOk: (conditionGroups: ConditionGroup[]) => void;
  onCancel: () => void;
}

/**
 * The editor's draft and everything that reads it — body and footer alike —
 * mounted fresh on each opening, so the draft seeds from the stored
 * conditions once and later parent re-renders cannot wipe it.
 */
const ConditionEditorContent: FC<ConditionEditorContentProps> = ({
  conditionGroups,
  readonly,
  onOk,
  onCancel
}) => {
  const { globalSubjects = [] } = useEditorPlugins();
  // The expression environment binds formData plus every context subject
  // (built-ins and host-supplied globals) as a top-level variable — list them
  // so the author doesn't have to guess the vocabulary.
  const expressionVariables = ["formData.字段key", "applicantId", "applicantDepartmentId", ...globalSubjects.map(subject => subject.key)].join("、");
  const [groups, setGroups] = useState(conditionGroups);
  const [mode, setMode] = useState(() => detectMode(conditionGroups));
  const [expressionText, setExpressionText] = useState(() => mode === "expression" ? conditionGroups[0]?.conditions[0]?.expression ?? "" : "");
  // Stable keys for the (removable) group cards; each card tracks its own
  // condition row keys internally.
  const groupKeys = useRowKeys(groups.length);

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
    <>
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
                <CodeEditor
                  basicSetupOptions={EXPRESSION_EDITOR_SETUP}
                  maxHeight={224}
                  minHeight={96}
                  placeholder="请输入条件表达式"
                  readOnly={readonly}
                  value={expressionText}
                  onChange={setExpressionText}
                />

                <div css={expressionHintStyle}>
                  可用变量:
                  {" "}
                  {expressionVariables}
                  ；支持 and / or / not 组合，例如 formData.amount &gt; 1000 and applicantDepartmentId == "dept-1"
                </div>
              </>
            )}
      </div>

      <div css={footerStyle}>
        {readonly
          ? <Button onClick={onCancel}>关闭</Button>
          : (
              <>
                <Button onClick={onCancel}>取消</Button>
                <Button type="primary" onClick={handleOk}>确定</Button>
              </>
            )}
      </div>
    </>
  );
};

/**
 * The branch condition editor. The draft lives in ConditionEditorContent, not
 * here, so a keystroke re-renders the content alone and never the Modal around
 * it: re-rendering the Modal re-runs its portal's dependency-less container
 * effect (@rc-component/portal), whose no-op state update React cannot always
 * skip, and fast typing then stacks those updates past React's nested-update
 * limit ("Maximum update depth exceeded"). destroyOnHidden remounts the
 * content on every opening, which is also what seeds the draft.
 */
export const ConditionEditorModal: FC<ConditionEditorModalProps> = ({
  open,
  conditionGroups,
  readonly,
  onOk,
  onCancel
}) => (
  <Modal
    destroyOnHidden
    footer={null}
    open={open}
    title="编辑条件"
    width={MODAL_WIDTH}
    onCancel={onCancel}
  >
    <ConditionEditorContent conditionGroups={conditionGroups} readonly={readonly} onCancel={onCancel} onOk={onOk} />
  </Modal>
);
