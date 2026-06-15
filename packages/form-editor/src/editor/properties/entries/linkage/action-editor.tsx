import type { FC, ReactElement } from "react";

import type { FieldLinkageAction, LinkageActionType, LinkageActionValue, LinkageAlertLevel } from "../../../../types";
import type { OptionItem, SourceFieldOption } from "./options";

import { Button, CodeEditor, Input, Segmented, Select, Switch } from "@vef-framework-react/components";
import { useMemo } from "react";

import { sanitizeKey } from "../../../../engine/keys";
import { isEffectAction } from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { coerceToString } from "../coerce";
import { expressionAssistExtensions } from "./expression-assist";
import { createActionFor, setActionValueMode } from "./mutators";
import { alertLevelOptions, isLinkageActionType } from "./options";
import {
  actionCardCss,
  actionDeleteCss,
  actionHeaderCss,
  actionRetriggerCss,
  actionRetriggerLabelCss,
  apiFieldsCss,
  codeEditorWrapperCss,
  defaultHintCss,
  defaultTextCss,
  selectStyle,
  valueEditorCss
} from "./styles";

const valueModeOptions = [
  { value: "literal", label: "字面量" },
  { value: "expression", label: "表达式" }
] as const;

export interface ActionEditorProps {
  action: FieldLinkageAction;
  /**
   * Action types offered for this rule, already filtered by trigger family and
   * keyed-ness (see `actionOptionsFor`).
   */
  availableActions: Array<OptionItem<LinkageActionType>>;
  /**
   * Same-scope keyed fields, used as `set_field` targets.
   */
  targetOptions: SourceFieldOption[];
  /**
   * Form-global data sources by id, used as `refresh_data_source` targets.
   */
  dataSourceOptions: SourceFieldOption[];
  /**
   * Whether the remove control is shown (a rule keeps at least one action).
   */
  canRemove: boolean;
  /**
   * Whether the rule's trigger is a `condition` — only then does a side-effect
   * action's `retrigger` (edge vs. always) apply, so the toggle shows just here.
   */
  isConditionTrigger: boolean;
  /**
   * Declared form-variable names, feeding the expression editors' completion
   * and unknown-key lint (same assist the condition editor gets).
   */
  variableNames?: string[];
  onChange: (next: FieldLinkageAction) => void;
  onRemove: () => void;
}

/**
 * Edits a single action within a rule's action list. The type select swaps the
 * whole action (resetting to that type's defaults); the body below renders the
 * type-specific inputs. A side-effect action under a `condition` trigger also
 * gets a "repeat while held" toggle that flips its `retrigger` to `"always"`.
 */
export const ActionEditor: FC<ActionEditorProps> = ({
  action,
  availableActions,
  canRemove,
  dataSourceOptions,
  isConditionTrigger,
  targetOptions,
  variableNames,
  onChange,
  onRemove
}) => {
  // The same scope-aware completion + unknown-key lint the condition editor
  // gets — script sources and expression values reference the identical scope.
  const assistExtensions = useMemo(
    () => expressionAssistExtensions({ fields: targetOptions, variables: variableNames ?? [] }),
    [targetOptions, variableNames]
  );

  return (
    <div css={actionCardCss}>
      <div css={actionHeaderCss}>
        <Select
          options={availableActions}
          style={selectStyle}
          value={action.type}
          onChange={value => {
            if (isLinkageActionType(value)) {
            // Swapping the type resets the payload to that type's defaults but
            // keeps the action's client-stable id, so the list key (and thus
            // this editor's DOM) survives the switch.
              const next = createActionFor(value);
              onChange(action.id === undefined ? next : { ...next, id: action.id });
            }
          }}
        />

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

      <ActionBody
        action={action}
        assistExtensions={assistExtensions}
        dataSourceOptions={dataSourceOptions}
        targetOptions={targetOptions}
        onChange={onChange}
      />

      {isConditionTrigger && isEffectAction(action) && (
        <div css={actionRetriggerCss}>
          {/* Title + persistent hint, mirroring the DefaultsPanel toggle rows,
              so the consequential edge-vs-always behavior is explained inline
              instead of hidden in a native (touch-invisible) tooltip. */}
          <div css={defaultTextCss}>
            <span css={actionRetriggerLabelCss}>重复触发</span>

            <span css={defaultHintCss}>
              条件持续满足期间，依赖字段每次变化都重新触发；关闭（默认）则仅在条件首次满足时触发一次。
            </span>
          </div>

          <Switch
            aria-label="重复触发"
            checked={action.retrigger === "always"}
            size="small"
            onChange={checked => {
              if (checked) {
                onChange({ ...action, retrigger: "always" });
                return;
              }

              // Turning the toggle off removes the key entirely (the default is
              // "edge") so the persisted action stays minimal.
              const next = { ...action };
              delete next.retrigger;
              onChange(next);
            }}
          />
        </div>
      )}
    </div>
  );
};

interface ActionBodyProps {
  action: FieldLinkageAction;
  assistExtensions: ReturnType<typeof expressionAssistExtensions>;
  dataSourceOptions: SourceFieldOption[];
  targetOptions: SourceFieldOption[];
  onChange: (next: FieldLinkageAction) => void;
}

/**
 * The type-specific inputs for one action. Declarative atoms (`show` / `hide` /
 * `submit` / ...) have no body.
 */
function ActionBody({
  action,
  assistExtensions,
  dataSourceOptions,
  targetOptions,
  onChange
}: ActionBodyProps): ReactElement | null {
  switch (action.type) {
    case "assign": {
      return (
        <ActionValueEditor
          assistExtensions={assistExtensions}
          expressionPlaceholder="field.A + field.B"
          literalPlaceholder="赋值内容"
          value={action.value}
          onChange={value => onChange({ ...action, value })}
        />
      );
    }

    case "set_field": {
      return (
        <>
          <Select
            options={targetOptions}
            placeholder="选择目标字段"
            style={selectStyle}
            value={action.targetKey.length > 0 ? action.targetKey : undefined}
            onChange={value => onChange({ ...action, targetKey: String(value) })}
          />

          <ActionValueEditor
            assistExtensions={assistExtensions}
            expressionPlaceholder="field.A"
            literalPlaceholder="写入的值"
            value={action.value}
            onChange={value => onChange({ ...action, value })}
          />
        </>
      );
    }

    case "set_variable": {
      return (
        <>
          <Input
            placeholder="变量名（$vars.名称）"
            value={action.variable}
            onChange={event => onChange({ ...action, variable: sanitizeKey(event.target.value) })}
          />

          <ActionValueEditor
            assistExtensions={assistExtensions}
            expressionPlaceholder="$vars.count + 1"
            literalPlaceholder="写入的值"
            value={action.value}
            onChange={value => onChange({ ...action, value })}
          />
        </>
      );
    }

    case "refresh_data_source": {
      return (
        <Select
          notFoundContent="请先在表单「数据源」中创建"
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
            assistExtensions={assistExtensions}
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
          assistExtensions={assistExtensions}
          expressionPlaceholder="'/orders/' + field.id"
          literalPlaceholder="目标路径，如 /orders"
          value={action.to}
          onChange={to => onChange({ ...action, to })}
        />
      );
    }

    case "api_call": {
      return (
        <div css={apiFieldsCss}>
          <Input
            placeholder="资源 (resource)"
            value={action.request.resource}
            onChange={event => onChange({ ...action, request: { ...action.request, resource: event.target.value } })}
          />

          <Input
            placeholder="动作 (action)"
            value={action.request.action}
            onChange={event => onChange({ ...action, request: { ...action.request, action: event.target.value } })}
          />
        </div>
      );
    }

    case "script": {
      return (
        <div css={codeEditorWrapperCss}>
          <CodeEditor
            showLineNumbers
            extensions={assistExtensions}
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

interface ActionValueEditorProps {
  value: LinkageActionValue;
  assistExtensions: ReturnType<typeof expressionAssistExtensions>;
  literalPlaceholder?: string;
  expressionPlaceholder?: string;
  onChange: (next: LinkageActionValue) => void;
}

/**
 * Literal / expression switch plus the matching input — the value editor shared
 * by `assign`, `set_field`, `alert`, and `navigate`.
 */
function ActionValueEditor({
  assistExtensions,
  expressionPlaceholder,
  literalPlaceholder,
  value,
  onChange
}: ActionValueEditorProps): ReactElement {
  return (
    <div css={valueEditorCss}>
      <Segmented
        options={[...valueModeOptions]}
        value={value.kind}
        onChange={mode => {
          if (mode === "literal" || mode === "expression") {
            onChange(setActionValueMode(value, mode));
          }
        }}
      />

      {value.kind === "literal"
        ? (
            <Input
              placeholder={literalPlaceholder}
              value={coerceToString(value.value)}
              onChange={event => onChange({ kind: "literal", value: event.target.value })}
            />
          )
        : (
            <div css={codeEditorWrapperCss}>
              <CodeEditor
                extensions={assistExtensions}
                language="javascript"
                minHeight={60}
                placeholder={expressionPlaceholder}
                showFoldGutter={false}
                showLineNumbers={false}
                size="small"
                value={value.source}
                onChange={source => onChange({ kind: "expression", source })}
              />
            </div>
          )}
    </div>
  );
}

function asAlertLevel(value: unknown): LinkageAlertLevel {
  return value === "success" || value === "warning" || value === "error" ? value : "info";
}
