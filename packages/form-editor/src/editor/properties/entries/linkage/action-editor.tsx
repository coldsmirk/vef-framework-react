import type { FC, ReactElement } from "react";

import type { PriorStepSchema } from "../../../../engine/linkage";
import type { ValidationSeverity } from "../../../../engine/validation";
import type { FieldLinkageAction, LinkageActionType, LinkageAlertLevel } from "../../../../types";
import type { OptionItem } from "./options";
import type { LinkageScope } from "./use-linkage-editor-model";

import { css } from "@emotion/react";
import { Button, CodeEditor, globalCssVars, Input, Select } from "@vef-framework-react/components";
import { useSortable } from "@vef-framework-react/core";
import { useMergedRef } from "@vef-framework-react/hooks";
import { useMemo } from "react";

import { sanitizeKey } from "../../../../engine/keys";
import { isEffectAction } from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { useDataSourceApis } from "../../../data-source-apis";
import { DynamicValueEditor } from "../../dynamic-value-editor";
import { ReferenceScopeProvider, useReferenceScope } from "../../reference-scope";
import { CatalogRemoteRequestEditor } from "../../remote-request-editor";
import { DragHandle } from "../../sortable-rows";
import { summarizeAction } from "./action-summary";
import { NO_COMPLETION_SETUP } from "./expression-input";
import { withOptional } from "./mutators";
import { OnErrorField } from "./on-error-field";
import { actionLabelFor, alertLevelOptions, isLinkageActionType } from "./options";
import { SelectRecordEditor } from "./select-record-editor";
import { SetFieldsEditor } from "./set-fields-editor";
import { StepOutputField } from "./step-output-field";
import {
  actionCardCss,
  codeEditorWrapperCss,
  selectStyle
} from "./styles";
import { useAttention } from "./use-attention";

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
  gap: 10,
  padding: "10px 12px 12px",
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

export interface ActionEditorProps {
  action: FieldLinkageAction;
  /**
   * The rule's whole sequence, and this step's place in it.
   */
  actions: readonly FieldLinkageAction[];
  index: number;
  sortableId: string;
  expanded: boolean;
  /**
   * Set while a diagnostic or submit check points at this step (see
   * {@link useAttention}).
   */
  attention: object | null;
  issueSeverity: ValidationSeverity | undefined;
  unsupportedReason: string | null;
  availableActions: Array<OptionItem<LinkageActionType>>;
  scope: LinkageScope;
  selfKey?: string;
  /**
   * The results this step can read; `undefined` for a state action, which
   * reads none.
   */
  priorSteps: readonly PriorStepSchema[] | undefined;
  /**
   * In-flight output name text when being edited (undefined means show the
   * action's stored output).
   */
  outputDraft: string | undefined;
  outputError: string | null;
  onToggleExpand: () => void;
  onChangeType: (nextType: LinkageActionType) => void;
  onChange: (next: FieldLinkageAction) => void;
  onOutputChange: (nextText: string) => void;
  onOutputCommit: () => void;
  onRemove: () => void;
}

/**
 * One step of a sequence inside the rule dialog: a one-line summary that
 * unfolds in place into the step's full editor.
 */
export const ActionEditor: FC<ActionEditorProps> = ({
  action,
  actions,
  attention,
  availableActions,
  expanded,
  index,
  issueSeverity,
  onChange,
  onChangeType,
  onOutputChange,
  onOutputCommit,
  onRemove,
  onToggleExpand,
  outputDraft,
  outputError,
  priorSteps,
  scope,
  selfKey,
  sortableId,
  unsupportedReason
}) => {
  const {
    handleRef,
    isDragging,
    ref: sortableRef
  } = useSortable({ id: sortableId, index });
  const { highlighted, ref: attentionRef } = useAttention(attention);
  const cardRef = useMergedRef<HTMLDivElement>(sortableRef, attentionRef);
  const apis = useDataSourceApis();
  const parentReferenceScope = useReferenceScope();

  const isOnlyStep = actions.length === 1;
  const selectOptions = availableActions.some(option => option.value === action.type)
    ? availableActions
    : [...availableActions, { value: action.type, label: actionLabelFor(action.type) }];

  const summary = useMemo(() => summarizeAction(action, scope, apis), [action, scope, apis]);
  const referenceScope = useMemo(
    () => priorSteps === undefined ? parentReferenceScope : { ...parentReferenceScope, priorSteps },
    [parentReferenceScope, priorSteps]
  );
  const effectiveSeverity: ValidationSeverity | undefined = outputError === null ? issueSeverity : "error";

  return (
    <div
      ref={cardRef}
      css={[
        stepCardCss,
        highlighted && stepCardHighlightedCss,
        isDragging && stepCardDraggingCss
      ]}
    >
      <div css={stepHeaderCss}>
        {isOnlyStep ? null : <DragHandle handleRef={handleRef} label={`拖动排序步骤 ${index + 1}`} />}

        <button
          aria-expanded={expanded}
          css={toggleSummaryCss}
          title={summary.text}
          type="button"
          onClick={onToggleExpand}
        >
          <span aria-hidden css={chevronCss}>
            <EditorIcon name={expanded ? "chevron-down" : "chevron-right"} />
          </span>

          <span css={stepIndexBadgeCss}>{index + 1}</span>

          {effectiveSeverity === undefined
            ? null
            : <span aria-hidden css={[issueDotCss, effectiveSeverity === "error" ? issueErrorDotCss : issueWarningDotCss]} />}

          <span css={[summaryTextCss, summary.incomplete && summaryIncompleteCss]}>{summary.text}</span>
        </button>

        <div css={badgeRowCss}>
          {isEffectAction(action) && action.onError === "continue" ? <span css={continueBadgeCss}>失败继续</span> : null}
          {unsupportedReason === null ? null : <span css={unsupportedBadgeCss}>当前宿主不支持</span>}

          {isOnlyStep
            ? null
            : (
                <Button
                  aria-label="删除动作"
                  css={iconButtonCss}
                  icon={<EditorIcon name="x" />}
                  size="small"
                  type="text"
                  onClick={onRemove}
                />
              )}
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
                  laterActions={actions.slice(index + 1)}
                  outputDraft={outputDraft}
                  outputError={outputError}
                  scope={scope}
                  selfKey={selfKey}
                  onChange={onChange}
                  onOutputChange={onOutputChange}
                  onOutputCommit={onOutputCommit}
                />
              </ReferenceScopeProvider>

              {isEffectAction(action)
                ? <OnErrorField value={action.onError} onChange={onError => onChange(withOptional(action, "onError", onError))} />
                : null}
            </div>
          )
        : null}
    </div>
  );
};

interface ActionBodyProps {
  action: FieldLinkageAction;
  laterActions: readonly FieldLinkageAction[];
  outputDraft: string | undefined;
  outputError: string | null;
  scope: LinkageScope;
  selfKey?: string;
  onChange: (next: FieldLinkageAction) => void;
  onOutputChange: (nextText: string) => void;
  onOutputCommit: () => void;
}

/**
 * The type-specific inputs for one action. Declarative atoms (`show` / `hide` /
 * `submit` / ...) have no body.
 */
function ActionBody({
  action,
  laterActions,
  onChange,
  onOutputChange,
  onOutputCommit,
  outputDraft,
  outputError,
  scope,
  selfKey
}: ActionBodyProps): ReactElement | null {
  switch (action.type) {
    case "assign": {
      return (
        <DynamicValueEditor
          dataSources={scope.dataSources}
          expressionPlaceholder="field.A + field.B"
          literalPlaceholder="赋值内容"
          targetField={selfKey === undefined ? undefined : scope.fieldsByKey.get(selfKey)}
          value={action.value}
          onChange={value => onChange({ ...action, value })}
        />
      );
    }

    case "set_fields": {
      return (
        <SetFieldsEditor
          assignments={action.assignments}
          scope={scope}
          selfKey={selfKey}
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

          <DynamicValueEditor
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
          options={scope.dataSourceOptions}
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

          <DynamicValueEditor
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
        <DynamicValueEditor
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

          <StepOutputField
            error={outputError}
            required={false}
            value={outputDraft ?? action.output ?? ""}
            onBlur={onOutputCommit}
            onChange={onOutputChange}
            onPressEnter={onOutputCommit}
          />
        </>
      );
    }

    case "select_record": {
      return (
        <SelectRecordEditor
          action={action}
          fieldsByKey={scope.fieldsByKey}
          laterActions={laterActions}
          outputControl={(
            <StepOutputField
              required
              error={outputError}
              value={outputDraft ?? action.output}
              onBlur={onOutputCommit}
              onChange={onOutputChange}
              onPressEnter={onOutputCommit}
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
