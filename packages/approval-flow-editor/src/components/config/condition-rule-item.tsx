import type { FC } from "react";

import type { ConditionDefinition, ConditionOperator, FormFieldDefinition } from "../../types";

import { css } from "@emotion/react";
import { Button, DatePicker, globalCssVars, Input, InputNumber, Select } from "@vef-framework-react/components";
import dayjs from "dayjs";
import { XIcon } from "lucide-react";

import { useEditorPlugins } from "../../plugins";
import { getOperatorsForFieldKind, MULTI_VALUE_OPERATORS, NO_VALUE_OPERATORS, OPERATOR_LABELS } from "./condition-operators";

const FULL_WIDTH_STYLE = { width: "100%" } as const;

/**
 * Applicant attributes the engine resolves from the instance context instead
 * of form data. They share the field-condition pipeline (same operators as a
 * text field), so the picker offers them alongside the form fields. These
 * subjects are reserved names on the backend — a form field with a colliding
 * key is shadowed.
 */
const BUILT_IN_SUBJECT_FIELDS: FormFieldDefinition[] = [
  {
    key: "applicantId",
    kind: "input",
    label: "发起人 ID"
  },
  {
    key: "applicantDepartmentId",
    kind: "input",
    label: "发起人部门 ID"
  }
];

/**
 * Coerce a heterogeneous option value to a Select-compatible primitive.
 */
function asSelectValue(value: unknown): string | number {
  return typeof value === "string" || typeof value === "number" ? value : String(value);
}

/**
 * Narrow a heterogeneous condition value to a string for text/select/date inputs.
 */
function asStringValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return typeof value === "string" ? value : String(value);
}

/**
 * Narrow a heterogeneous condition value to a number for numeric inputs.
 */
function asNumberValue(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isNaN(parsed) ? undefined : parsed;
}

const ruleRowStyle = css({
  display: "flex",
  gap: 6,
  alignItems: "flex-start"
});

const ruleFieldsStyle = css({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6
});

const ruleSelectRowStyle = css({
  display: "flex",
  gap: 6
});

const fieldSelectStyle = css({
  flex: 5,
  minWidth: 0
});

const operatorSelectStyle = css({
  flex: 4,
  minWidth: 0
});

const deleteButtonStyle = css({
  flexShrink: 0,
  width: 32,
  height: 32,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: globalCssVars.borderRadius,
  color: globalCssVars.colorTextQuaternary,
  transition: "all 0.2s",

  "&:not(:disabled):hover": {
    color: globalCssVars.colorErrorText,
    background: globalCssVars.colorErrorBg
  }
});

interface ConditionRuleItemProps {
  condition: ConditionDefinition;
  readonly: boolean;
  onChange: (condition: ConditionDefinition) => void;
  onRemove: () => void;
}

export const ConditionRuleItem: FC<ConditionRuleItemProps> = ({
  condition,
  readonly,
  onChange,
  onRemove
}) => {
  const { formFields = [], globalSubjects = [] } = useEditorPlugins();
  // Resolution order mirrors the engine: built-in applicant subjects, then
  // host-supplied globals, then form data. A key colliding with an earlier
  // layer is shadowed at runtime, so the duplicate is dropped here instead of
  // offering a dead option.
  const globalSubjectFields = globalSubjects.filter(g => BUILT_IN_SUBJECT_FIELDS.every(b => b.key !== g.key));
  const contextSubjectFields = [...BUILT_IN_SUBJECT_FIELDS, ...globalSubjectFields];
  const subjectFields = [
    ...contextSubjectFields,
    ...formFields.filter(f => contextSubjectFields.every(c => c.key !== f.key))
  ];
  const selectedField = subjectFields.find(f => f.key === condition.subject);
  const operators = selectedField ? getOperatorsForFieldKind(selectedField.kind) : [];
  const isNoValue = (NO_VALUE_OPERATORS as readonly string[]).includes(condition.operator);
  const isMultiValue = (MULTI_VALUE_OPERATORS as readonly string[]).includes(condition.operator);

  const handleFieldChange = (key: string) => {
    onChange({
      ...condition,
      subject: key,
      operator: "",
      value: undefined
    });
  };

  const handleOperatorChange = (op: ConditionOperator) => {
    const nextValue = NO_VALUE_OPERATORS.includes(op) ? undefined : condition.value;
    onChange({
      ...condition,
      operator: op,
      value: nextValue
    });
  };

  const renderValueInput = () => {
    if (isNoValue || !selectedField || !condition.operator) {
      return null;
    }

    const { kind } = selectedField;

    if (isMultiValue && kind === "select" && selectedField.options) {
      return (
        <Select
          disabled={readonly}
          mode="multiple"
          options={selectedField.options.map(o => { return { label: o.label, value: asSelectValue(o.value) }; })}
          placeholder="请选择"
          value={Array.isArray(condition.value) ? condition.value : []}
          onChange={value => onChange({ ...condition, value })}
        />
      );
    }

    if (isMultiValue) {
      return (
        <Select
          disabled={readonly}
          mode="tags"
          placeholder="输入后回车添加"
          value={Array.isArray(condition.value) ? condition.value : []}
          onChange={value => onChange({ ...condition, value })}
        />
      );
    }

    if (kind === "select" && selectedField.options) {
      return (
        <Select
          disabled={readonly}
          options={selectedField.options.map(o => { return { label: o.label, value: asSelectValue(o.value) }; })}
          placeholder="请选择"
          value={asStringValue(condition.value)}
          onChange={value => onChange({ ...condition, value })}
        />
      );
    }

    if (kind === "number") {
      return (
        <InputNumber
          disabled={readonly}
          placeholder="请输入数值"
          style={FULL_WIDTH_STYLE}
          value={asNumberValue(condition.value)}
          onChange={value => onChange({ ...condition, value })}
        />
      );
    }

    if (kind === "date") {
      // The condition stores the wire value as a string; antd's DatePicker only
      // accepts dayjs at runtime (a string value type-checks via the ValueType
      // generic but throws on render), so convert at this boundary.
      const stringValue = asStringValue(condition.value);
      const dateValue = stringValue ? dayjs(stringValue) : null;

      return (
        <DatePicker
          disabled={readonly}
          style={FULL_WIDTH_STYLE}
          value={dateValue?.isValid() ? dateValue : null}
          onChange={(_date, dateString) => onChange({ ...condition, value: dateString })}
        />
      );
    }

    return (
      <Input
        disabled={readonly}
        placeholder="请输入值"
        value={asStringValue(condition.value) ?? ""}
        onChange={event => onChange({ ...condition, value: event.currentTarget.value })}
      />
    );
  };

  const valueInput = renderValueInput();

  return (
    <div css={ruleRowStyle}>
      <div css={ruleFieldsStyle}>
        <div css={ruleSelectRowStyle}>
          <Select
            css={fieldSelectStyle}
            disabled={readonly}
            options={subjectFields.map(f => { return { label: f.label, value: f.key }; })}
            placeholder="选择字段"
            value={condition.subject || undefined}
            onChange={handleFieldChange}
          />

          {selectedField && (
            <Select
              css={operatorSelectStyle}
              disabled={readonly}
              options={operators.map(op => { return { label: OPERATOR_LABELS[op] ?? op, value: op }; })}
              placeholder="运算符"
              value={condition.operator || undefined}
              onChange={handleOperatorChange}
            />
          )}
        </div>

        {valueInput}
      </div>

      <Button
        css={deleteButtonStyle}
        disabled={readonly}
        type="text"
        onClick={onRemove}
      >
        <XIcon size={14} />
      </Button>
    </div>
  );
};
