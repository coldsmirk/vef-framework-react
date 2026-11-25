import type { FC, ReactElement } from "react";

import type { FieldAssignment, FieldLinkageAction, LinkageActionType, LinkageAlertLevel, SelectRecordWhenNone } from "../../../../types";
import type { OptionItem, SourceFieldOption } from "./options";

import { css } from "@emotion/react";
import { Button, CodeEditor, globalCssVars, Input, Select } from "@vef-framework-react/components";
import { useMemo } from "react";

import { sanitizeKey } from "../../../../engine/keys";
import { EditorIcon } from "../../../../icons";
import { DynamicValueEditor as ActionValueEditor } from "../../dynamic-value-editor";
import { RemoteRequestEditor } from "../../remote-request-editor";
import { NO_COMPLETION_SETUP } from "./expression-input";
import { createActionFor } from "./mutators";
import { actionLabelFor, alertLevelOptions, isLinkageActionType } from "./options";
import {
  actionCardCss,
  actionDeleteCss,
  actionHeaderCss,
  addInlineButtonCss,
  codeEditorWrapperCss,
  selectStyle
} from "./styles";

const assignmentRowCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: 8,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorBgContainer
});

const assignmentHeaderCss = css({
  display: "flex",
  alignItems: "center",
  gap: 6
});

const WHEN_NONE_OPTIONS: Array<OptionItem<SelectRecordWhenNone>> = [
  { value: "stop", label: "无匹配时终止后续动作" },
  { value: "continue", label: "无匹配时继续（结果为空）" }
];

export interface ActionEditorProps {
  action: FieldLinkageAction;
  /**
   * Action types offered for this rule, already filtered by trigger family,
   * keyed-ness, and wired host services (see `actionOptionsFor`).
   */
  availableActions: Array<OptionItem<LinkageActionType>>;
  /**
   * Same-scope writable keyed fields, used as `set_fields` targets.
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
  onChange: (next: FieldLinkageAction) => void;
  onRemove: () => void;
}

/**
 * Edits a single action within a rule's action list. Stored actions whose type
 * is omitted from `availableActions` (e.g. `api_call` / `navigate` when the
 * host has not wired that service) stay selectable and editable so opening an
 * existing schema never loses data.
 */
export const ActionEditor: FC<ActionEditorProps> = ({
  action,
  availableActions,
  canRemove,
  dataSourceOptions,
  targetOptions,
  onChange,
  onRemove
}) => {
  const selectOptions = useMemo(
    () => availableActions.some(option => option.value === action.type)
      ? availableActions
      : [...availableActions, { value: action.type, label: actionLabelFor(action.type) }],
    [action.type, availableActions]
  );

  return (
    <div css={actionCardCss}>
      <div css={actionHeaderCss}>
        <Select
          options={selectOptions}
          style={selectStyle}
          value={action.type}
          onChange={value => {
            if (!isLinkageActionType(value)) {
              return;
            }

            // Swapping the type resets the payload to that type's defaults but
            // keeps the action's client-stable id, so the list key (and thus
            // this editor's DOM) survives the switch.
            const next = createActionFor(value);
            onChange(action.id === undefined ? next : { ...next, id: action.id });
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
        dataSourceOptions={dataSourceOptions}
        targetOptions={targetOptions}
        onChange={onChange}
      />
    </div>
  );
};

interface ActionBodyProps {
  action: FieldLinkageAction;
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
  dataSourceOptions,
  targetOptions,
  onChange
}: ActionBodyProps): ReactElement | null {
  switch (action.type) {
    case "assign": {
      return (
        <ActionValueEditor
          expressionPlaceholder="field.A + field.B"
          literalPlaceholder="赋值内容"
          value={action.value}
          onChange={value => onChange({ ...action, value })}
        />
      );
    }

    case "set_fields": {
      const updateAssignment = (index: number, next: FieldAssignment): void => {
        onChange({
          ...action,
          assignments: action.assignments.map((item, current) => current === index ? next : item)
        });
      };

      const removeAssignment = (index: number): void => {
        onChange({
          ...action,
          assignments: action.assignments.filter((_, current) => current !== index)
        });
      };

      const addAssignment = (): void => {
        onChange({
          ...action,
          assignments: [...action.assignments, { targetKey: "", value: { kind: "literal", value: "" } }]
        });
      };

      return (
        <>
          {action.assignments.map((assignment, index) => (
            <div key={index} css={assignmentRowCss}>
              <div css={assignmentHeaderCss}>
                <Select
                  options={targetOptions}
                  placeholder="选择目标字段"
                  style={selectStyle}
                  value={assignment.targetKey.length > 0 ? assignment.targetKey : undefined}
                  onChange={value => updateAssignment(index, { ...assignment, targetKey: String(value) })}
                />

                {action.assignments.length > 1
                  ? (
                      <Button
                        aria-label="删除字段赋值"
                        css={actionDeleteCss}
                        icon={<EditorIcon name="x" />}
                        size="small"
                        type="text"
                        onClick={() => removeAssignment(index)}
                      />
                    )
                  : null}
              </div>

              <ActionValueEditor
                expressionPlaceholder="field.A"
                literalPlaceholder="写入的值"
                value={assignment.value}
                onChange={value => updateAssignment(index, { ...assignment, value })}
              />
            </div>
          ))}

          <Button
            css={addInlineButtonCss}
            icon={<EditorIcon name="plus" />}
            size="small"
            type="dashed"
            onClick={addAssignment}
          >
            新增字段赋值
          </Button>
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
      // The full request — version and bound parameters included, which the
      // runtime resolves before `FormServices.request` runs.
      return (
        <>
          <RemoteRequestEditor request={action.request} onChange={request => onChange({ ...action, request })} />

          <Input
            placeholder="结果名（可选，供后续动作引用 $steps.名称）"
            value={action.output ?? ""}
            onChange={event => {
              const sanitized = sanitizeKey(event.target.value);

              if (sanitized.length === 0) {
                const next = { ...action };
                delete next.output;
                onChange(next);
                return;
              }

              onChange({ ...action, output: sanitized });
            }}
          />
        </>
      );
    }

    case "select_record": {
      return (
        <>
          <ActionValueEditor
            expressionPlaceholder="$steps.res"
            literalPlaceholder="来源数据"
            referencePlaceholder="来源路径，如 $steps.res"
            value={action.source}
            onChange={source => onChange({ ...action, source })}
          />

          <Input
            placeholder="结果名（必填，如 selected）"
            value={action.output}
            onChange={event => onChange({ ...action, output: sanitizeKey(event.target.value) })}
          />

          <Input
            placeholder="弹窗标题（可选）"
            value={action.title ?? ""}
            onChange={event => {
              const title = event.target.value;

              if (title.length === 0) {
                const next = { ...action };
                delete next.title;
                onChange(next);
                return;
              }

              onChange({ ...action, title });
            }}
          />

          <Input
            placeholder="无匹配提示（可选）"
            value={action.emptyMessage ?? ""}
            onChange={event => {
              const emptyMessage = event.target.value;

              if (emptyMessage.length === 0) {
                const next = { ...action };
                delete next.emptyMessage;
                onChange(next);
                return;
              }

              onChange({ ...action, emptyMessage });
            }}
          />

          <Select
            options={WHEN_NONE_OPTIONS}
            style={selectStyle}
            value={action.whenNone ?? "stop"}
            onChange={value => {
              if (value === "continue") {
                onChange({ ...action, whenNone: "continue" });
                return;
              }

              const next = { ...action };
              delete next.whenNone;
              onChange(next);
            }}
          />
        </>
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
