import type { ReactElement } from "react";

import type { DynamicValue, FormDataSource, FormField } from "../../types";

import { css } from "@emotion/react";
import { Segmented } from "@vef-framework-react/components";

import { ExpressionInput } from "./entries/linkage/expression-input";
import { codeEditorWrapperCss, valueEditorCss } from "./entries/linkage/styles";
import { ReferencePicker } from "./reference-scope";
import { defaultLiteralValueForField, TypedLiteralInput } from "./typed-literal-input";

const containerCss = css({
  containerType: "inline-size",
  flex: 1,
  minWidth: 0
});

// In wide surfaces (such as the data-source modal or action modal) a single-line
// literal or reference sits beside its mode switcher so each parameter or
// assignment fits on one row; expressions stay stacked so CodeMirror keeps the
// full width.
const inlineValueEditorCss = css({
  "@container (min-width: 340px)": {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  }
});

const modeSwitcherCss = css({
  flexShrink: 0,
  alignSelf: "flex-start"
});

const inputGrowCss = css({
  flex: 1,
  minWidth: 0
});

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
export function setDynamicValueMode(
  current: DynamicValue,
  mode: DynamicValueMode,
  targetField?: FormField
): DynamicValue {
  if (mode === "literal") {
    return current.kind === "literal" ? current : { kind: "literal", value: defaultLiteralValueForField(targetField) };
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
  /**
   * Target field being written (`set_fields` / `assign`): drives the typed
   * literal control (number, switch, date/datetime/daterange, static options).
   */
  targetField?: FormField;
  /**
   * Form-global data sources used to resolve `ref`-to-static option lists for
   * selection target fields.
   */
  dataSources?: readonly FormDataSource[];
  onChange: (next: DynamicValue) => void;
}

/**
 * Literal / reference / expression switch plus the matching input — the one
 * control for every place the designer offers "a fixed value or a bound one":
 * linkage action values and remote request parameters. Sharing it keeps every
 * surface aligned on typed literals, grouped reference picking, and expression
 * editing.
 */
export function DynamicValueEditor({
  dataSources,
  expressionPlaceholder,
  literalPlaceholder,
  onChange,
  referencePlaceholder,
  targetField,
  value
}: DynamicValueEditorProps): ReactElement {
  return (
    <div css={containerCss}>
      <div css={[valueEditorCss, value.kind !== "expression" && inlineValueEditorCss]}>
        <Segmented
          css={modeSwitcherCss}
          options={[...VALUE_MODES]}
          value={value.kind}
          onChange={mode => {
            if (isDynamicValueMode(mode)) {
              onChange(setDynamicValueMode(value, mode, targetField));
            }
          }}
        />

        {value.kind === "literal"
          ? (
              <div css={inputGrowCss}>
                <TypedLiteralInput
                  dataSources={dataSources}
                  field={targetField}
                  placeholder={literalPlaceholder}
                  value={value.value}
                  onChange={next => onChange({ kind: "literal", value: next })}
                />
              </div>
            )
          : value.kind === "reference"
            ? (
                <div css={inputGrowCss}>
                  <ReferencePicker
                    placeholder={referencePlaceholder}
                    value={value.path}
                    onChange={path => onChange({ kind: "reference", path })}
                  />
                </div>
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
    </div>
  );
}
