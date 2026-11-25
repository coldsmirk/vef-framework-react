import type { ReactElement } from "react";

import type { DynamicValue } from "../../types";

import { Input, Segmented } from "@vef-framework-react/components";

import { coerceToString } from "./entries/coerce";
import { ExpressionInput } from "./entries/linkage/expression-input";
import { codeEditorWrapperCss, valueEditorCss } from "./entries/linkage/styles";

const VALUE_MODES = [
  { value: "literal", label: "字面量" },
  { value: "reference", label: "引用" },
  { value: "expression", label: "表达式" }
] as const;

type DynamicValueMode = DynamicValue["kind"];

function isDynamicValueMode(value: unknown): value is DynamicValueMode {
  return value === "literal" || value === "reference" || value === "expression";
}

/**
 * Switch a value between the three modes, keeping it when the mode is unchanged
 * so toggling the control back and forth does not discard what was typed.
 */
export function setDynamicValueMode(current: DynamicValue, mode: DynamicValueMode): DynamicValue {
  if (mode === "literal") {
    return current.kind === "literal" ? current : { kind: "literal", value: "" };
  }

  if (mode === "reference") {
    return current.kind === "reference" ? current : { kind: "reference", path: "" };
  }

  return current.kind === "expression" ? current : { kind: "expression", source: "" };
}

export interface DynamicValueEditorProps {
  value: DynamicValue;
  literalPlaceholder?: string;
  referencePlaceholder?: string;
  expressionPlaceholder?: string;
  onChange: (next: DynamicValue) => void;
}

/**
 * Literal / reference / expression switch plus the matching input — shared by
 * linkage action values and remote request parameters.
 */
export function DynamicValueEditor({
  expressionPlaceholder,
  literalPlaceholder,
  referencePlaceholder = "字段键或作用域路径，如 $steps.res.name",
  value,
  onChange
}: DynamicValueEditorProps): ReactElement {
  return (
    <div css={valueEditorCss}>
      <Segmented
        options={[...VALUE_MODES]}
        value={value.kind}
        onChange={mode => {
          if (isDynamicValueMode(mode)) {
            onChange(setDynamicValueMode(value, mode));
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
        : value.kind === "reference"
          ? (
              <Input
                placeholder={referencePlaceholder}
                value={value.path}
                onChange={event => onChange({ kind: "reference", path: event.target.value })}
              />
            )
          : (
              <div css={codeEditorWrapperCss}>
                <ExpressionInput
                  placeholder={expressionPlaceholder}
                  value={value.source}
                  onChange={source => onChange({ kind: "expression", source })}
                />
              </div>
            )}
    </div>
  );
}
