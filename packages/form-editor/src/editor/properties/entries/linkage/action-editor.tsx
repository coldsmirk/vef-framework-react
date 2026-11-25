import type { ChangeEvent, FC, ReactElement } from "react";

import type { PriorStepSchema, WritableTargetField } from "../../../../engine/linkage";
import type { ValidationSeverity } from "../../../../engine/validation";
import type {
  ActionErrorPolicy,
  FieldLinkageAction,
  FormDataSource,
  FormField,
  KeyedFormField,
  LinkageActionType,
  LinkageAlertLevel
} from "../../../../types";
import type { ReferenceScope } from "../../reference-scope";
import type { ActionSummaryContext } from "./action-summary";
import type { OptionItem, SourceFieldOption } from "./options";

import { css } from "@emotion/react";
import { Button, CodeEditor, globalCssVars, Input, Select } from "@vef-framework-react/components";
import { useSortable } from "@vef-framework-react/core";
import { useMemo, useState } from "react";

import { sanitizeKey } from "../../../../engine/keys";
import { collectStepOutputNames, isEffectAction } from "../../../../engine/linkage";
import { isValidIdentifier } from "../../../../engine/validation";
import { EditorIcon } from "../../../../icons";
import { DynamicValueEditor as ActionValueEditor } from "../../dynamic-value-editor";
import { ReferenceScopeProvider } from "../../reference-scope";
import { CatalogRemoteRequestEditor } from "../../remote-request-editor";
import { formatActionSummaryLine, summarizeAction } from "./action-summary";
import { NO_COMPLETION_SETUP } from "./expression-input";
import { actionLabelFor, alertLevelOptions, isLinkageActionType } from "./options";
import { SelectRecordEditor } from "./select-record-editor";
import { SetFieldsEditor } from "./set-fields-editor";
import {
  actionCardCss,
  actionDeleteCss,
  codeEditorWrapperCss,
  selectStyle
} from "./styles";

const ON_ERROR_OPTIONS: Array<OptionItem<ActionErrorPolicy>> = [
  { value: "stop", label: "失败时终止后续动作（默认）" },
  { value: "continue", label: "忽略错误继续后续动作" }
];

const stepCardCss = css({
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorFillQuaternary,
  transition: `border-color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}, box-shadow ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
});

const stepCardHighlightedCss = css({
  borderColor: globalCssVars.colorPrimary,
  boxShadow: `0 0 0 2px ${globalCssVars.colorPrimaryBg}`
});

const stepCardDraggingCss = css({
  background: globalCssVars.colorBgElevated,
  boxShadow: globalCssVars.shadowLg
});

const stepHeaderCss = css({
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 8px",
  minHeight: 38
});

const dragHandleCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 22,
  flexShrink: 0,
  borderRadius: globalCssVars.borderRadiusSm,
  color: globalCssVars.colorTextTertiary,
  cursor: "grab",
  transition: `color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}, background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "&:hover": {
    color: globalCssVars.colorText,
    background: globalCssVars.colorFillTertiary
  },

  "&:focus-visible": {
    outline: "none",
    color: globalCssVars.colorText,
    background: globalCssVars.colorFillTertiary,
    boxShadow: `0 0 0 2px ${globalCssVars.colorPrimaryBorder}`
  },

  "&:active": {
    cursor: "grabbing"
  },

  "& > svg": {
    width: 14,
    height: 14
  }
});

const toggleSummaryCss = css({
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 4px",
  border: "none",
  borderRadius: globalCssVars.borderRadiusSm,
  background: "transparent",
  color: globalCssVars.colorText,
  textAlign: "left",
  cursor: "pointer",
  transition: `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "&:hover": {
    background: globalCssVars.colorFillTertiary
  },

  "&:focus-visible": {
    outline: "none",
    boxShadow: `0 0 0 2px ${globalCssVars.colorPrimaryBorder}`
  }
});

const chevronCss = css({
  display: "inline-flex",
  flexShrink: 0,
  color: globalCssVars.colorTextTertiary,

  "& > svg": {
    width: 14,
    height: 14
  }
});

const stepIndexBadgeCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 18,
  height: 18,
  padding: "0 4px",
  borderRadius: 9,
  background: globalCssVars.colorFillSecondary,
  fontSize: 11,
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: globalCssVars.colorTextSecondary,
  flexShrink: 0
});

const summaryTextCss = css({
  flex: 1,
  minWidth: 0,
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  lineHeight: 1.4,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const summaryIncompleteCss = css({
  color: globalCssVars.colorTextSecondary
});

const issueDotCss = css({
  width: 6,
  height: 6,
  borderRadius: "50%",
  flexShrink: 0
});

const issueErrorDotCss = css({
  background: globalCssVars.colorError
});

const issueWarningDotCss = css({
  background: globalCssVars.colorWarning
});

const badgeRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexShrink: 0
});

const continueBadgeCss = css({
  padding: "1px 6px",
  borderRadius: 9,
  background: globalCssVars.colorFillSecondary,
  fontSize: 11,
  color: globalCssVars.colorTextSecondary,
  whiteSpace: "nowrap"
});

const unsupportedBadgeCss = css({
  padding: "1px 6px",
  borderRadius: 9,
  background: globalCssVars.colorWarningBg,
  fontSize: 11,
  color: globalCssVars.colorWarningText,
  whiteSpace: "nowrap"
});

const iconButtonCss = css({
  width: 26,
  height: 26,
  padding: 0,
  flexShrink: 0
});

const stepBodyCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "8px 10px 10px",
  borderTop: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const unsupportedBannerCss = css({
  display: "flex",
  alignItems: "flex-start",
  gap: 6,
  padding: "6px 8px",
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorWarningBg,
  color: globalCssVars.colorWarningText,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5
});

const fieldStackCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 4
});

const fieldLabelCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const fieldErrorCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorErrorText,
  lineHeight: 1.4
});

const fieldHintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.4
});

const onErrorRowCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  paddingTop: 4,
  borderTop: `1px dashed ${globalCssVars.colorBorderSecondary}`
});

export interface OnErrorSelectProps {
  value: ActionErrorPolicy | undefined;
  onChange: (next: ActionErrorPolicy) => void;
}

export function OnErrorSelect({ onChange, value }: OnErrorSelectProps): ReactElement {
  return (
    <Select
      aria-label="失败处理"
      options={ON_ERROR_OPTIONS}
      style={selectStyle}
      value={value ?? "stop"}
      onChange={next => onChange(next === "continue" ? "continue" : "stop")}
    />
  );
}

interface StepOutputInputProps {
  value: string;
  required: boolean;
  placeholder: string;
  usedNames: ReadonlySet<string>;
  onCommit: (nextOutput: string | undefined) => void;
}

/**
 * Draft-buffered step output name input for inline editing inside the right
 * panel. Validates identifier syntax and rule-wide uniqueness on commit; valid
 * renames propagate to all subsequent `$steps.<old>` references in one step.
 */
function StepOutputInput({
  onCommit,
  placeholder,
  required,
  usedNames,
  value
}: StepOutputInputProps): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const current = draft ?? value;
  const trimmed = current.trim();

  let error: string | null = null;

  if (trimmed.length === 0) {
    if (required) {
      error = "请填写结果名";
    }
  } else if (!isValidIdentifier(trimmed)) {
    error = "结果名需以字母或下划线开头，仅含字母、数字或下划线";
  } else if (usedNames.has(trimmed)) {
    error = `结果名「${trimmed}」与本规则其它步骤重复`;
  }

  const commit = (): void => {
    if (draft === null) {
      return;
    }

    const next = draft.trim();
    setDraft(null);

    if (next === value) {
      return;
    }

    if (next.length === 0) {
      if (!required) {
        onCommit(undefined);
      }

      return;
    }

    if (isValidIdentifier(next) && !usedNames.has(next)) {
      onCommit(next);
    }
  };

  return (
    <div css={fieldStackCss}>
      <span css={fieldLabelCss}>{required ? "结果名" : "结果名（可选）"}</span>

      <Input
        aria-label="步骤结果名"
        placeholder={placeholder}
        status={error === null ? undefined : "warning"}
        value={current}
        onBlur={commit}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(sanitizeKey(event.target.value))}
        onFocus={() => setDraft(value)}
        onPressEnter={commit}
      />

      {error === null
        ? <span css={fieldHintCss}>改名后将自动更新后续步骤中的引用</span>
        : <span css={fieldErrorCss}>{error}</span>}
    </div>
  );
}

export interface ActionEditorProps {
  action: FieldLinkageAction;
  actionIndex: number;
  allActions: readonly FieldLinkageAction[];
  sortableId: string;
  expanded: boolean;
  highlighted: boolean;
  canReorder: boolean;
  canRemove: boolean;
  canEditInModal: boolean;
  issueSeverity: ValidationSeverity | undefined;
  unsupportedReason: string | null;
  availableActions: Array<OptionItem<LinkageActionType>>;
  targetOptions: SourceFieldOption[];
  writableTargets: readonly WritableTargetField[];
  scopeFieldsByKey: ReadonlyMap<string, KeyedFormField>;
  dataSources: readonly FormDataSource[];
  dataSourceOptions: SourceFieldOption[];
  ownerField?: FormField;
  referenceScope: ReferenceScope;
  priorSteps: readonly PriorStepSchema[];
  summaryContext: ActionSummaryContext;
  stepRef?: (node: HTMLDivElement | null) => void;
  onToggleExpand: () => void;
  onOpenModal: () => void;
  onChangeType: (nextType: LinkageActionType) => void;
  onChange: (next: FieldLinkageAction) => void;
  onRenameOutput: (nextOutput: string | undefined) => void;
  onRemove: () => void;
}

/**
 * Collapsible, drag-sortable step card for one linkage action. Keeps the whole
 * sequence scannable in one screen when collapsed (showing a plain-Chinese
 * summary, `失败继续` / `当前宿主不支持` badges, and a direct modal-edit trigger
 * for complex steps), and unfolds into the full inline editor when expanded.
 */
export const ActionEditor: FC<ActionEditorProps> = ({
  action,
  actionIndex,
  allActions,
  availableActions,
  canEditInModal,
  canRemove,
  canReorder,
  dataSourceOptions,
  dataSources,
  expanded,
  highlighted,
  issueSeverity,
  onChange,
  onChangeType,
  onOpenModal,
  onRemove,
  onRenameOutput,
  onToggleExpand,
  ownerField,
  priorSteps,
  referenceScope,
  scopeFieldsByKey,
  sortableId,
  stepRef,
  summaryContext,
  targetOptions,
  unsupportedReason,
  writableTargets
}) => {
  const {
    handleRef,
    isDragging,
    ref: sortableRef
  } = useSortable({ id: sortableId, index: actionIndex });

  const selectOptions = useMemo(
    () => availableActions.some(option => option.value === action.type)
      ? availableActions
      : [...availableActions, { value: action.type, label: actionLabelFor(action.type) }],
    [action.type, availableActions]
  );

  const summary = useMemo(
    () => summarizeAction(action, summaryContext),
    [action, summaryContext]
  );

  const summaryLine = formatActionSummaryLine(summary);
  const effectAction = isEffectAction(action);

  const usedOutputs = useMemo(
    () => collectStepOutputNames(allActions, actionIndex),
    [allActions, actionIndex]
  );

  const setCardRef = (node: HTMLDivElement | null): void => {
    sortableRef(node);
    stepRef?.(node);
  };

  return (
    <div
      ref={setCardRef}
      data-action-index={actionIndex}
      css={[
        stepCardCss,
        highlighted && stepCardHighlightedCss,
        isDragging && stepCardDraggingCss
      ]}
    >
      <div css={stepHeaderCss}>
        {canReorder
          ? (
              <span
                ref={handleRef}
                aria-label={`拖动排序步骤 ${actionIndex + 1}`}
                css={dragHandleCss}
                role="button"
                tabIndex={0}
                title="拖动排序"
              >
                <EditorIcon name="grip-vertical" />
              </span>
            )
          : null}

        <button
          aria-expanded={expanded}
          css={toggleSummaryCss}
          title={summaryLine}
          type="button"
          onClick={onToggleExpand}
        >
          <span aria-hidden css={chevronCss}>
            <EditorIcon name={expanded ? "chevron-down" : "chevron-right"} />
          </span>

          <span css={stepIndexBadgeCss}>{actionIndex + 1}</span>

          {issueSeverity === undefined
            ? null
            : <span aria-hidden css={[issueDotCss, issueSeverity === "error" ? issueErrorDotCss : issueWarningDotCss]} />}

          <span css={[summaryTextCss, summary.incomplete && summaryIncompleteCss]}>
            {summaryLine}
          </span>
        </button>

        <div css={badgeRowCss}>
          {effectAction && action.onError === "continue"
            ? <span css={continueBadgeCss}>失败继续</span>
            : null}

          {unsupportedReason === null
            ? null
            : <span css={unsupportedBadgeCss}>当前宿主不支持</span>}

          {canEditInModal
            ? (
                <Button
                  aria-label="弹窗编辑步骤"
                  css={iconButtonCss}
                  icon={<EditorIcon name="square-pen" />}
                  size="small"
                  title="在宽弹窗中编辑"
                  type="text"
                  onClick={onOpenModal}
                />
              )
            : null}

          {canRemove
            ? (
                <Button
                  aria-label="删除动作"
                  css={actionDeleteCss}
                  icon={<EditorIcon name="x" />}
                  size="small"
                  type="text"
                  onClick={onRemove}
                />
              )
            : null}
        </div>
      </div>

      {expanded
        ? (
            <div css={stepBodyCss}>
              <Select
                options={selectOptions}
                style={selectStyle}
                value={action.type}
                onChange={value => {
                  if (isLinkageActionType(value) && value !== action.type) {
                    onChangeType(value);
                  }
                }}
              />

              {unsupportedReason === null
                ? null
                : (
                    <div css={unsupportedBannerCss} role="status">
                      <EditorIcon name="triangle-alert" />
                      <span>{unsupportedReason}</span>
                    </div>
                  )}

              <ReferenceScopeProvider value={referenceScope}>
                <ActionBody
                  action={action}
                  actionIndex={actionIndex}
                  allActions={allActions}
                  dataSourceOptions={dataSourceOptions}
                  dataSources={dataSources}
                  ownerField={ownerField}
                  priorSteps={priorSteps}
                  scopeFieldsByKey={scopeFieldsByKey}
                  targetOptions={targetOptions}
                  usedOutputs={usedOutputs}
                  writableTargets={writableTargets}
                  onChange={onChange}
                  onRenameOutput={onRenameOutput}
                />
              </ReferenceScopeProvider>

              {effectAction
                ? (
                    <div css={onErrorRowCss}>
                      <span css={fieldLabelCss}>失败处理</span>

                      <OnErrorSelect
                        value={action.onError}
                        onChange={next => {
                          if (next === "continue") {
                            onChange({ ...action, onError: "continue" });
                            return;
                          }

                          const cleaned = { ...action };
                          delete cleaned.onError;
                          onChange(cleaned);
                        }}
                      />
                    </div>
                  )
                : null}
            </div>
          )
        : null}
    </div>
  );
};

interface ActionBodyProps {
  action: FieldLinkageAction;
  actionIndex: number;
  allActions: readonly FieldLinkageAction[];
  dataSources: readonly FormDataSource[];
  dataSourceOptions: SourceFieldOption[];
  ownerField?: FormField;
  priorSteps: readonly PriorStepSchema[];
  scopeFieldsByKey: ReadonlyMap<string, KeyedFormField>;
  targetOptions: SourceFieldOption[];
  usedOutputs: ReadonlySet<string>;
  writableTargets: readonly WritableTargetField[];
  onChange: (next: FieldLinkageAction) => void;
  onRenameOutput: (nextOutput: string | undefined) => void;
}

/**
 * The type-specific inputs for one action. Declarative atoms (`show` / `hide` /
 * `submit` / ...) have no body.
 */
function ActionBody({
  action,
  actionIndex,
  allActions,
  dataSourceOptions,
  dataSources,
  onChange,
  onRenameOutput,
  ownerField,
  priorSteps,
  scopeFieldsByKey,
  targetOptions,
  usedOutputs,
  writableTargets
}: ActionBodyProps): ReactElement | null {
  switch (action.type) {
    case "assign": {
      return (
        <ActionValueEditor
          dataSources={dataSources}
          expressionPlaceholder="field.A + field.B"
          literalPlaceholder="赋值内容"
          targetField={ownerField}
          value={action.value}
          onChange={value => onChange({ ...action, value })}
        />
      );
    }

    case "set_fields": {
      return (
        <SetFieldsEditor
          assignments={action.assignments}
          dataSources={dataSources}
          priorSteps={priorSteps}
          targetOptions={targetOptions}
          writableTargets={writableTargets}
          onChange={assignments => onChange({ ...action, assignments })}
        />
      );
    }

    case "set_variable": {
      return (
        <div css={actionCardCss}>
          <Input
            placeholder="变量名"
            value={action.variable}
            onChange={event => onChange({ ...action, variable: sanitizeKey(event.target.value) })}
          />

          <ActionValueEditor
            expressionPlaceholder="$vars.count + 1"
            literalPlaceholder="写入的值"
            value={action.value}
            onChange={value => onChange({ ...action, value })}
          />
        </div>
      );
    }

    case "refresh_data_source": {
      return (
        <Select
          notFoundContent="请先在左侧「数据」页中创建"
          options={dataSourceOptions}
          placeholder="选择数据源"
          style={selectStyle}
          value={action.dataSourceId.length > 0 ? action.dataSourceId : undefined}
          onChange={value => onChange({ ...action, dataSourceId: String(value) })}
        />
      );
    }

    case "alert": {
      return (
        <>
          <Select
            options={alertLevelOptions}
            style={selectStyle}
            value={action.level ?? "info"}
            onChange={value => onChange({ ...action, level: asAlertLevel(value) })}
          />

          <ActionValueEditor
            expressionPlaceholder="field.name + ' 已保存'"
            literalPlaceholder="提示内容"
            value={action.message}
            onChange={message => onChange({ ...action, message })}
          />
        </>
      );
    }

    case "navigate": {
      return (
        <ActionValueEditor
          expressionPlaceholder="'/orders/' + field.id"
          literalPlaceholder="目标路径，如 /orders"
          value={action.to}
          onChange={to => onChange({ ...action, to })}
        />
      );
    }

    case "api_call": {
      return (
        <>
          <CatalogRemoteRequestEditor
            showDeclaredFields
            request={action.request}
            onChange={request => onChange({ ...action, request })}
          />

          <StepOutputInput
            placeholder="如 result（留空不保存结果）"
            required={false}
            usedNames={usedOutputs}
            value={action.output ?? ""}
            onCommit={onRenameOutput}
          />
        </>
      );
    }

    case "select_record": {
      return (
        <SelectRecordEditor
          action={action}
          actionIndex={actionIndex}
          allActions={allActions}
          scopeFieldsByKey={scopeFieldsByKey}
          outputControl={(
            <StepOutputInput
              required
              placeholder="如 selected"
              usedNames={usedOutputs}
              value={action.output}
              onCommit={next => {
                if (next !== undefined) {
                  onRenameOutput(next);
                }
              }}
            />
          )}
          onChange={onChange}
        />
      );
    }

    case "script": {
      return (
        <div css={codeEditorWrapperCss}>
          <CodeEditor
            showLineNumbers
            basicSetupOptions={NO_COMPLETION_SETUP}
            language="javascript"
            minHeight={90}
            showFoldGutter={false}
            size="small"
            value={action.source}
            placeholder='if (field.A === "x") return { hidden: true };
return { value: field.B + field.C };'
            onChange={source => onChange({ ...action, source })}
          />
        </div>
      );
    }

    default: {
      // show / hide / enable / disable / require / optional / submit / reset.
      return null;
    }
  }
}

function asAlertLevel(value: unknown): LinkageAlertLevel {
  return value === "success" || value === "warning" || value === "error" ? value : "info";
}
