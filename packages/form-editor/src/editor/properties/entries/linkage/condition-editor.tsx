import type { FC } from "react";

import type {
  LinkageCondition,
  LinkageConditionGroup,
  LinkageConditionLeaf
} from "../../../../types";
import type { SourceFieldOption } from "./options";

import { Button, CodeEditor, Input, Popconfirm, Segmented, Select } from "@vef-framework-react/components";
import { useMemo, useState } from "react";

import { EditorIcon } from "../../../../icons";
import { coerceToString } from "../coerce";
import { expressionAssistExtensions } from "./expression-assist";
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
import { isLinkageOperator, isLogicValue, logicOptions, operatorNeedsValue, operatorOptions } from "./options";
import {
  addInlineButtonCss,
  addRowCss,
  codeEditorWrapperCss,
  conditionGroupCss,
  conditionGroupHeaderCss,
  conditionNoticeCss,
  conditionRowCss,
  conditionRowDeleteCss,
  conditionRowFullCss,
  expressionHeaderLabelCss,
  missingSourceLabelCss,
  selectStyle
} from "./styles";

export interface ConditionEditorProps {
  condition: LinkageCondition;
  sourceOptions: SourceFieldOption[];
  /**
   * Declared form-variable names, feeding `$vars.` autocompletion in
   * expression mode.
   */
  variableNames?: string[];
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
  sourceOptions,
  variableNames,
  selfKey,
  onChange
}) => {
  if (condition.kind === "expression") {
    return (
      <ExpressionConditionEditor
        condition={condition}
        selfKey={selfKey}
        sourceOptions={sourceOptions}
        variableNames={variableNames}
        onChange={onChange}
      />
    );
  }

  if (condition.kind === "group") {
    return (
      <GroupConditionEditor
        condition={condition}
        depth={0}
        sourceOptions={sourceOptions}
        variableNames={variableNames}
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
    <GroupConditionEditor
      depth={0}
      sourceOptions={sourceOptions}
      variableNames={variableNames}
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
  sourceOptions: SourceFieldOption[];
  variableNames?: string[];
  selfKey?: string;
  onChange: (next: LinkageCondition) => void;
}

const NO_VARIABLES: string[] = [];

const ExpressionConditionEditor: FC<ExpressionConditionEditorProps> = ({
  condition,
  sourceOptions,
  variableNames = NO_VARIABLES,
  selfKey,
  onChange
}) => {
  // Shown (instead of committing an empty group) when "切换到可视化" is clicked
  // while no keyed field exists to seed the visual builder with.
  const [noSourceNotice, setNoSourceNotice] = useState(false);
  const authored = conditionHasAuthoredContent(condition);

  // Scope-aware completion (field keys, declared variables) + unknown-key
  // lint — without these the designer types keys from memory and a typo
  // silently never matches.
  const assistExtensions = useMemo(
    () => expressionAssistExtensions({ fields: sourceOptions, variables: variableNames }),
    [sourceOptions, variableNames]
  );

  const switchToVisual = (): void => {
    // Prefer a field other than the rule's own: a self-referencing show rule
    // is almost always a mistake — mirroring how a freshly created rule seeds
    // its first condition.
    const seed = sourceOptions.find(option => option.value !== selfKey)?.value ?? sourceOptions[0]?.value;

    if (!seed) {
      setNoSourceNotice(true);
      return;
    }

    onChange(createGroup([createLeaf(seed)]));
  };

  const switchButton = (
    <Button icon={<EditorIcon name="git-branch" />} size="small" type="text" onClick={authored && sourceOptions.length > 0 ? undefined : switchToVisual}>
      切换到可视化
    </Button>
  );

  return (
    <div css={conditionGroupCss}>
      <div css={conditionGroupHeaderCss}>
        <span css={expressionHeaderLabelCss}>JS 表达式（返回布尔）</span>

        {authored && sourceOptions.length > 0
          ? (
              <Popconfirm
                cancelText="取消"
                okText="切换"
                title="切换到可视化将丢弃当前表达式"
                onConfirm={switchToVisual}
              >
                {switchButton}
              </Popconfirm>
            )
          : switchButton}
      </div>

      <div css={codeEditorWrapperCss}>
        <CodeEditor
          extensions={assistExtensions}
          language="javascript"
          minHeight={60}
          placeholder='field.A === "foo" && field.B > 10'
          showFoldGutter={false}
          showLineNumbers={false}
          size="small"
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
  sourceOptions: SourceFieldOption[];
  /**
   * Declared form-variable names, feeding `$vars.` completion and unknown-key
   * lint for a nested `expression` leaf (the same assist the top-level
   * expression editor gets).
   */
  variableNames?: string[];
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
  sourceOptions,
  variableNames = NO_VARIABLES,
  onChange,
  onRemoveSelf,
  onSwitchToExpression
}) => {
  const canNest = depth < MAX_CONDITION_NESTING_DEPTH;
  const canAddLeaf = sourceOptions.length > 0;
  const authored = conditionHasAuthoredContent(condition);

  // The same scope-aware completion + unknown-key lint the top-level expression
  // editor builds, so a nested `expression` leaf is not a blind text box where a
  // mistyped field key silently never matches.
  const assistExtensions = useMemo(
    () => expressionAssistExtensions({ fields: sourceOptions, variables: variableNames }),
    [sourceOptions, variableNames]
  );

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

      onChange(createGroup([createLeaf(sourceOptions[0]?.value ?? "")]));
      return;
    }

    onChange(removeAtPath(condition, [index]));
  };

  const addLeaf = (): void => {
    const seed = sourceOptions[0]?.value;

    if (!seed) {
      return;
    }

    onChange(appendChild(condition, [], createLeaf(seed)));
  };

  const addGroup = (): void => {
    const seed = sourceOptions[0]?.value;

    if (!seed) {
      return;
    }

    onChange(appendChild(condition, [], createGroup([createLeaf(seed)])));
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
              <Popconfirm
                cancelText="取消"
                okText="切换"
                title="切换到表达式将丢弃当前可视化条件"
                onConfirm={onSwitchToExpression}
              >
                {switchButton}
              </Popconfirm>
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
              sourceOptions={sourceOptions}
              variableNames={variableNames}
              onChange={next => updateChild(index, next)}
              onRemoveSelf={() => removeChild(index)}
            />
          );
        }

        if (child.kind === "expression") {
          // Nested expression at a leaf slot is unusual but supported by
          // the data model. Render it without a "switch to visual" affordance.
          return (
            <div key={child.id ?? index} css={conditionRowCss}>
              <div css={[codeEditorWrapperCss, conditionRowFullCss]}>
                <CodeEditor
                  extensions={assistExtensions}
                  language="javascript"
                  minHeight={36}
                  placeholder="JS 表达式"
                  showFoldGutter={false}
                  showLineNumbers={false}
                  size="small"
                  value={child.source}
                  onChange={source => updateChild(index, { ...child, source })}
                />
              </div>

              <Button
                aria-label="删除条件"
                css={conditionRowDeleteCss}
                icon={<EditorIcon name="x" />}
                size="small"
                type="text"
                onClick={() => removeChild(index)}
              />
            </div>
          );
        }

        return (
          <LeafConditionEditor
            key={child.id ?? index}
            condition={child}
            sourceOptions={sourceOptions}
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
  sourceOptions: SourceFieldOption[];
  onChange: (next: LinkageConditionLeaf) => void;
  onRemove: () => void;
}

const LeafConditionEditor: FC<LeafConditionEditorProps> = ({
  condition,
  sourceOptions,
  onChange,
  onRemove
}) => {
  const showValueInput = operatorNeedsValue(condition.operator);
  const hasSource = condition.sourceKey.length > 0;
  // A dangling sourceKey (its field was deleted or renamed elsewhere) keeps
  // its raw key visible with an explicit "未找到字段" affordance instead of
  // silently rendering the bare string as if it resolved.
  const sourceUnresolved = hasSource && !sourceOptions.some(option => option.value === condition.sourceKey);
  const leafSourceOptions = sourceUnresolved
    ? [
        ...sourceOptions,
        {
          value: condition.sourceKey,
          label: <span css={missingSourceLabelCss}>{`${condition.sourceKey}（未找到字段）`}</span>
        }
      ]
    : sourceOptions;

  return (
    <div css={conditionRowCss}>
      <Select
        options={leafSourceOptions}
        placeholder="选择源字段"
        style={selectStyle}
        value={hasSource ? condition.sourceKey : undefined}
        onChange={value => onChange({ ...condition, sourceKey: String(value) })}
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
            ...operatorNeedsValue(value) ? {} : { value: undefined }
          });
        }}
      />

      <Button
        aria-label="删除条件"
        css={conditionRowDeleteCss}
        icon={<EditorIcon name="x" />}
        size="small"
        type="text"
        onClick={onRemove}
      />

      {showValueInput
        ? (
            <Input
              css={conditionRowFullCss}
              placeholder="比较值"
              value={coerceToString(condition.value)}
              onChange={event => onChange({ ...condition, value: event.target.value })}
            />
          )
        : null}
    </div>
  );
};
