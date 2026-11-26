import type { FC } from "react";

import type {
  LinkageCondition,
  LinkageConditionGroup,
  LinkageConditionLeaf
} from "../../../../types";

import { Button, Input, Segmented, Select } from "@vef-framework-react/components";
import { useState } from "react";

import { EditorIcon } from "../../../../icons";
import { ReferencePicker, useReferenceScope } from "../../reference-scope";
import { SwitchConfirm } from "../../switch-confirm";
import { coerceToString } from "../coerce";
import { ExpressionInput } from "./expression-input";
import {
  appendChild,
  conditionHasAuthoredContent,
  createExpression,
  createGroup,
  createLeaf,
  MAX_CONDITION_NESTING_DEPTH,
  removeAtPath,
  updateAtPath
} from "./mutators";
import { isLinkageOperator, isLogicValue, logicOptions, operatorNeedsValue, operatorOptions, seedSourceKey } from "./options";
import {
  actionDeleteCss,
  addInlineButtonCss,
  addRowCss,
  codeEditorWrapperCss,
  conditionExpressionRowCss,
  conditionGroupCss,
  conditionGroupHeaderCss,
  conditionNoticeCss,
  conditionRowCss,
  conditionRowDeleteCss,
  conditionRowWithValueCss,
  conditionValueCss,
  expressionHeaderLabelCss,
  selectStyle
} from "./styles";

export interface ConditionEditorProps {
  condition: LinkageCondition;
  /**
   * The owning block's data-binding key. The expression → visual switch
   * seeds its first condition with another field when one exists — a
   * self-referencing show rule is almost always a mistake.
   */
  selfKey?: string;
  onChange: (next: LinkageCondition) => void;
}

/**
 * Top-level wrapper. The root condition is always a `group` or an
 * `expression` — a bare `leaf` is never the rule's top condition. Mode
 * switching here is a destructive replace (group ↔ expression) because
 * there is no general way to reverse-translate a free-form JS expression
 * back into a structured tree; a switch that would discard authored content
 * is gated behind a confirmation.
 */
export const ConditionEditor: FC<ConditionEditorProps> = ({
  condition,
  selfKey,
  onChange
}) => {
  if (condition.kind === "expression") {
    return (
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering
      <ExpressionConditionEditor
        condition={condition}
        selfKey={selfKey}
        onChange={onChange}
      />
    );
  }

  if (condition.kind === "group") {
    return (
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering
      <GroupConditionEditor
        condition={condition}
        depth={0}
        onChange={onChange}
        onSwitchToExpression={() => onChange(createExpression())}
      />
    );
  }

  // A bare leaf at root is wrapped on the fly — keeps the UI's invariant
  // (root = group | expression) without forcing data migrations. The wrapper
  // is built inline WITHOUT an id (ids only matter as list keys, and the root
  // group is never in a list) so rendering stays pure — minting a cuid here
  // would produce a different id per render / StrictMode pass. The wrapped
  // group is committed as-is on the first edit.
  return (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering
    <GroupConditionEditor
      depth={0}
      condition={{
        kind: "group",
        logic: "all",
        children: [condition]
      }}
      onChange={onChange}
      onSwitchToExpression={() => onChange(createExpression())}
    />
  );
};

interface ExpressionConditionEditorProps {
  condition: Extract<LinkageCondition, { kind: "expression" }>;
  selfKey?: string;
  onChange: (next: LinkageCondition) => void;
}

const ExpressionConditionEditor: FC<ExpressionConditionEditorProps> = ({
  condition,
  selfKey,
  onChange
}) => {
  const { fieldOptions } = useReferenceScope();
  // Shown (instead of committing an empty group) when "切换到可视化" is clicked
  // while no keyed field exists to seed the visual builder with.
  const [noSourceNotice, setNoSourceNotice] = useState(false);
  const authored = conditionHasAuthoredContent(condition);

  const switchToVisual = (): void => {
    // Prefer a field other than the rule's own: a self-referencing show rule
    // is almost always a mistake — mirroring how a freshly created rule seeds
    // its first condition.
    const seed = seedSourceKey(fieldOptions, selfKey) ?? fieldOptions[0]?.value;

    if (!seed) {
      setNoSourceNotice(true);
      return;
    }

    onChange(createGroup([createLeaf(seed)]));
  };

  const switchButton = (
    <Button icon={<EditorIcon name="git-branch" />} size="small" type="text" onClick={authored && fieldOptions.length > 0 ? undefined : switchToVisual}>
      切换到可视化
    </Button>
  );

  return (
    <div css={conditionGroupCss}>
      <div css={conditionGroupHeaderCss}>
        <span css={expressionHeaderLabelCss}>JS 表达式（返回布尔）</span>

        {authored && fieldOptions.length > 0
          ? (
              <SwitchConfirm
                title="切换到可视化将丢弃当前表达式"
                onConfirm={switchToVisual}
              >
                {switchButton}
              </SwitchConfirm>
            )
          : switchButton}
      </div>

      <div css={codeEditorWrapperCss}>
        <ExpressionInput
          placeholder="field.A === 'foo' && field.B > 10"
          value={condition.source}
          onChange={source => onChange({ ...condition, source })}
        />
      </div>

      {noSourceNotice
        ? <span css={conditionNoticeCss}>当前作用域内没有可引用的字段，暂时无法切换到可视化条件</span>
        : null}
    </div>
  );
};

interface GroupConditionEditorProps {
  condition: LinkageConditionGroup;
  depth: number;
  /**
   * Switch the entire root condition into expression mode. Only the depth-0
   * group exposes this — nested groups do not (mode-switching mid-tree
   * would require unintuitive partial replacement).
   */
  onChange: (next: LinkageCondition) => void;
  onSwitchToExpression?: () => void;
  /**
   * Remove this group from its parent. Provided to nested groups only; when
   * deleting a nested group's last child would leave it empty, the whole group
   * is removed instead — an empty group silently evaluates to "always true",
   * so the editor never authors one.
   */
  onRemoveSelf?: () => void;
}

const GroupConditionEditor: FC<GroupConditionEditorProps> = ({
  condition,
  depth,
  onChange,
  onRemoveSelf,
  onSwitchToExpression
}) => {
  const { fieldOptions } = useReferenceScope();
  const seed = fieldOptions[0]?.value;
  const canNest = depth < MAX_CONDITION_NESTING_DEPTH;
  const canAddLeaf = seed !== undefined;
  const authored = conditionHasAuthoredContent(condition);

  const updateChild = (index: number, next: LinkageCondition): void => {
    onChange(updateAtPath(condition, [index], () => next));
  };

  const removeChild = (index: number): void => {
    // Removing the last child must not leave an empty group behind (empty
    // `all` is ALWAYS TRUE at runtime — a silent foot-gun). A nested group
    // removes itself from its parent; the root group reseeds with a fresh
    // leaf (an unconfigured leaf row when no source field exists yet).
    if (condition.children.length <= 1) {
      if (onRemoveSelf) {
        onRemoveSelf();
        return;
      }

      onChange(createGroup([createLeaf(seed ?? "")]));
      return;
    }

    onChange(removeAtPath(condition, [index]));
  };

  const addLeaf = (): void => {
    if (seed !== undefined) {
      onChange(appendChild(condition, [], createLeaf(seed)));
    }
  };

  const addGroup = (): void => {
    if (seed === undefined) {
      return;
    }

    const group = createGroup([createLeaf(seed)]);

    onChange(appendChild(condition, [], group));
  };

  const updateLogic = (logic: "all" | "any"): void => {
    onChange({ ...condition, logic });
  };

  const switchButton = onSwitchToExpression
    ? (
        <Button
          icon={<EditorIcon name="code" />}
          size="small"
          type="text"
          onClick={authored ? undefined : onSwitchToExpression}
        >
          切换到表达式
        </Button>
      )
    : null;

  return (
    <div css={conditionGroupCss}>
      <div css={conditionGroupHeaderCss}>
        <Segmented
          options={logicOptions}
          value={condition.logic}
          onChange={value => {
            if (isLogicValue(value)) {
              updateLogic(value);
            }
          }}
        />

        {switchButton && authored
          ? (
              <SwitchConfirm
                title="切换到表达式将丢弃当前可视化条件"
                onConfirm={onSwitchToExpression}
              >
                {switchButton}
              </SwitchConfirm>
            )
          : switchButton}
      </div>

      {condition.children.map((child, index) => {
        if (child.kind === "group") {
          return (
            <GroupConditionEditor
              key={child.id ?? index}
              condition={child}
              depth={depth + 1}
              onChange={next => updateChild(index, next)}
              onRemoveSelf={() => removeChild(index)}
            />
          );
        }

        if (child.kind === "expression") {
          // Nested expression at a leaf slot is unusual but supported by
          // the data model. Render it without a "switch to visual" affordance.
          return (
            <div key={child.id ?? index} css={conditionExpressionRowCss}>
              <div css={codeEditorWrapperCss}>
                <ExpressionInput
                  minHeight={36}
                  placeholder="JS 表达式"
                  value={child.source}
                  onChange={source => updateChild(index, { ...child, source })}
                />
              </div>

              <Button
                aria-label="删除条件"
                css={actionDeleteCss}
                icon={<EditorIcon name="x" />}
                size="small"
                type="text"
                onClick={() => removeChild(index)}
              />
            </div>
          );
        }

        return (
          // eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering
          <LeafConditionEditor
            key={child.id ?? index}
            condition={child}
            onChange={next => updateChild(index, next)}
            onRemove={() => removeChild(index)}
          />
        );
      })}

      <div css={addRowCss}>
        <Button
          css={addInlineButtonCss}
          disabled={!canAddLeaf}
          icon={<EditorIcon name="plus" />}
          size="small"
          type="dashed"
          onClick={addLeaf}
        >
          新增条件
        </Button>

        {canNest
          ? (
              <Button
                css={addInlineButtonCss}
                disabled={!canAddLeaf}
                icon={<EditorIcon name="folder-plus" />}
                size="small"
                type="dashed"
                onClick={addGroup}
              >
                新增条件组
              </Button>
            )
          : null}
      </div>
    </div>
  );
};

interface LeafConditionEditorProps {
  condition: LinkageConditionLeaf;
  onChange: (next: LinkageConditionLeaf) => void;
  onRemove: () => void;
}

const LeafConditionEditor: FC<LeafConditionEditorProps> = ({
  condition,
  onChange,
  onRemove
}) => {
  const showValueInput = operatorNeedsValue(condition.operator);

  return (
    <div css={[conditionRowCss, showValueInput && conditionRowWithValueCss]}>
      <ReferencePicker
        placeholder="选择源字段"
        value={condition.sourceKey}
        onChange={sourceKey => onChange({ ...condition, sourceKey })}
      />

      <Select
        options={operatorOptions}
        style={selectStyle}
        value={condition.operator}
        onChange={value => {
          if (!isLinkageOperator(value)) {
            return;
          }

          onChange({
            ...condition,
            operator: value,
            ...!operatorNeedsValue(value) && { value: undefined }
          });
        }}
      />

      {showValueInput
        ? (
            <Input
              css={conditionValueCss}
              placeholder="比较值"
              value={coerceToString(condition.value)}
              onChange={event => onChange({ ...condition, value: event.target.value })}
            />
          )
        : null}

      <Button
        aria-label="删除条件"
        css={conditionRowDeleteCss}
        icon={<EditorIcon name="x" />}
        size="small"
        type="text"
        onClick={onRemove}
      />
    </div>
  );
};
