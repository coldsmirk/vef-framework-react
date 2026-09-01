import type { ReactElement } from "react";

import type { DynamicValue } from "../../types";

import { Input, Segmented } from "@vef-framework-react/components";

import { coerceToString } from "./entries/coerce";
import { ExpressionInput } from "./entries/linkage/expression-input";
import { codeEditorWrapperCss, valueEditorCss } from "./entries/linkage/styles";

const VALUE_MODES = [
  { value: "literal", label: "字面量" },
  { value: "expression", label: "表达式" }
] as const;

type DynamicValueMode = DynamicValue["kind"];

function isDynamicValueMode(value: unknown): value is DynamicValueMode {
  return value === "literal" || value === "expression";
}

/**
 * Switch a value between the two modes, keeping it when the mode is unchanged
 * so toggling the control back and forth does not discard what was typed.
 */
export function setDynamicValueMode(current: DynamicValue, mode: DynamicValueMode): DynamicValue {
  if (mode === "literal") {
    return current.kind === "literal" ? current : { kind: "literal", value: "" };
  }

  return current.kind === "expression" ? current : { kind: "expression", source: "" };
}

export interface DynamicValueEditorProps {
  value: DynamicValue;
  literalPlaceholder?: string;
  expressionPlaceholder?: string;
  onChange: (next: DynamicValue) => void;
}

/**
 * Literal / expression switch plus the matching input — the one control for
 * every place the designer offers "a fixed value or a bound one": linkage
 * action values and remote data-source request parameters. Sharing it is what
 * keeps the two from drifting into different affordances for the same schema
 * shape.
 */
export function DynamicValueEditor({
  expressionPlaceholder,
  literalPlaceholder,
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
