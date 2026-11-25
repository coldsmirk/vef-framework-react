import type { SelectProps } from "@vef-framework-react/components";
import type { ReactElement, ReactNode } from "react";

import type { PriorStepSchema } from "../../engine/linkage";
import type { FormVariable, LinkageContextSource } from "../../types";
import type { SourceFieldOption } from "./entries/linkage/options";

import { css } from "@emotion/react";
import { globalCssVars, Input, Select } from "@vef-framework-react/components";
import { createContext, use, useMemo } from "react";

import { parseLeafSource } from "../../engine/linkage/scope";
import { useFieldsReferenceScope, useScopeFields } from "./scope-fields";

/**
 * What a condition or a `{ kind: "reference" }` value can refer to where it is
 * edited. Conditions and references read one scope through one picker, so they
 * never diverge on what they offer.
 */
export interface ReferenceScope {
  fieldOptions: readonly SourceFieldOption[];
  variables: readonly FormVariable[];
  contextSources: readonly LinkageContextSource[];
  /**
   * The results of the steps before the one being edited; absent where no step
   * result can be read.
   */
  priorSteps?: readonly PriorStepSchema[];
}

const ReferenceScopeContext = createContext<ReferenceScope | null>(null);
ReferenceScopeContext.displayName = "ReferenceScopeContext";

export function ReferenceScopeProvider({
  children,
  value
}: {
  value: ReferenceScope;
  children: ReactNode;
}): ReactElement {
  return <ReferenceScopeContext value={value}>{children}</ReferenceScopeContext>;
}

export function useReferenceScope(): ReferenceScope {
  const scope = use(ReferenceScopeContext);

  if (scope === null) {
    throw new Error("A <ReferenceScopeProvider> ancestor is required to edit a reference.");
  }

  return scope;
}

/**
 * Provides the scope `nodeId` sits in (`null` for the form itself) to the
 * request parameters of a node's option source or a form-global data source.
 */
export function NodeReferenceScopeProvider({
  children,
  nodeId
}: {
  nodeId: string | null;
  children: ReactNode;
}): ReactElement {
  return <ReferenceScopeProvider value={useFieldsReferenceScope(useScopeFields(nodeId))}>{children}</ReferenceScopeProvider>;
}

/**
 * The popup's width. The select itself often shares a row, so a popup matching
 * it would cut a field's "label · key" and a system variable's name mid-word.
 */
const POPUP_WIDTH = 260;

const pickerStackCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6,
  flex: 1,
  minWidth: 0
});

const optionRowCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minWidth: 0
});

const optionLabelCss = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const optionHintCss = css({
  flexShrink: 0,
  fontFamily: globalCssVars.fontFamilyCode,
  fontSize: 11,
  color: globalCssVars.colorTextTertiary
});

const unresolvedLabelCss = css({
  color: globalCssVars.colorWarningText
});

const subPathRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 6
});

const subPathPrefixCss = css({
  flexShrink: 0,
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const selectFullWidth = { width: "100%" } as const;

interface ReferenceOptionItem {
  value: string;
  label: ReactNode;
  title: string;
  hint?: string;
}

interface ReferenceOptionGroup {
  label: string;
  title: string;
  options: ReferenceOptionItem[];
}

export interface ResolvedReferenceOptions {
  options: NonNullable<SelectProps["options"]>;
  /**
   * The selected option: the stored path, except for a path into a step whose
   * fields are not declared (`$steps.info.name`), where the select holds the
   * step and {@link freeStepTarget} the rest.
   */
  selectValue: string | undefined;
  /**
   * The step whose result has no declared fields, and the path into it, which
   * the designer types.
   */
  freeStepTarget: { step: PriorStepSchema; subPath: string } | null;
  unresolved: boolean;
}

const VARIABLE_TYPE_LABELS: Record<FormVariable["type"], string> = {
  string: "文本",
  number: "数字",
  boolean: "布尔",
  json: "JSON"
};

function stepPath(step: PriorStepSchema, subPath = ""): string {
  return subPath.length > 0 ? `$steps.${step.output}.${subPath}` : `$steps.${step.output}`;
}

function stepGroup(step: PriorStepSchema): ReferenceOptionGroup {
  const label = `步骤 ${step.index + 1} · ${step.label}`;

  return {
    label,
    title: label,
    options: [
      {
        value: stepPath(step),
        label: step.kind === "select_record" ? `${step.label}（整条记录）` : `${step.label}（完整结果）`,
        title: `${label} 完整结果 ${step.output}`,
        hint: step.output
      },
      ...step.fields.map(field => {
        return {
          value: stepPath(step, field.path),
          label: field.label,
          title: `${label} ${field.label} ${field.path}`,
          hint: field.path
        };
      })
    ]
  };
}

/**
 * The grouped options of one {@link ReferenceScope} — earlier steps first,
 * being what a step usually reads — and how the stored path resolves among
 * them.
 */
export function buildReferenceOptions(scope: ReferenceScope, currentPath: string): ResolvedReferenceOptions {
  const priorSteps = scope.priorSteps ?? [];
  const parsed = currentPath.length > 0 ? parseLeafSource(currentPath) : undefined;

  const fields: ReferenceOptionItem[] = scope.fieldOptions.map(field => {
    return {
      value: field.value,
      label: field.label,
      title: field.label
    };
  });

  // The explicit `$form.<key>` spelling names the same field.
  const explicitField = parsed?.kind === "form" && parsed.path.length === 0 && parsed.key !== currentPath
    ? scope.fieldOptions.find(field => field.value === parsed.key)
    : undefined;

  if (explicitField !== undefined) {
    fields.push({
      value: currentPath,
      label: explicitField.label,
      title: `${explicitField.label} ${currentPath}`
    });
  }

  const groups: ReferenceOptionGroup[] = [
    ...priorSteps.map(step => stepGroup(step)),
    {
      label: "表单字段",
      title: "表单字段",
      options: fields
    },
    {
      label: "表单变量",
      title: "表单变量",
      options: scope.variables.filter(variable => variable.name.length > 0).map(variable => {
        return {
          value: `$vars.${variable.name}`,
          label: variable.name,
          title: `${variable.name} ${VARIABLE_TYPE_LABELS[variable.type]}`,
          hint: VARIABLE_TYPE_LABELS[variable.type]
        };
      })
    },
    {
      label: "系统变量",
      title: "系统变量",
      options: scope.contextSources.map(source => {
        return {
          value: source.key,
          label: source.label,
          title: `${source.label} ${source.key}`
        };
      })
    }
  ].filter(group => group.options.length > 0);

  const freeStep = parsed?.kind === "step"
    ? priorSteps.find(step => step.output === parsed.step && step.fields.length === 0)
    : undefined;
  const freeStepTarget = parsed?.kind === "step" && freeStep !== undefined
    ? { step: freeStep, subPath: parsed.path.join(".") }
    : null;
  const unresolved = parsed !== undefined
    && freeStepTarget === null
    && groups.every(group => group.options.every(option => option.value !== currentPath));

  const unresolvedOptions: ReferenceOptionItem[] = unresolved
    ? [
        {
          value: currentPath,
          label: <span css={unresolvedLabelCss}>{`${currentPath}（未识别）`}</span>,
          title: currentPath
        }
      ]
    : [];

  // One heading over fields alone says nothing, so those stay a flat list.
  const [onlyGroup] = groups;
  const isFieldsOnly = groups.length === 1 && onlyGroup !== undefined && onlyGroup.options === fields;

  return {
    options: [...isFieldsOnly ? fields : groups, ...unresolvedOptions],
    selectValue: freeStepTarget === null ? currentPath || undefined : stepPath(freeStepTarget.step),
    freeStepTarget,
    unresolved
  };
}

export interface ReferencePickerProps {
  value: string;
  placeholder?: string;
  onChange: (path: string) => void;
}

/**
 * Searchable picker over the surrounding {@link ReferenceScope}. A step whose
 * fields are not declared takes a typed path into its result; a stored path
 * the scope does not know stays visible and marked rather than vanishing.
 */
export function ReferencePicker({
  onChange,
  placeholder = "选择引用数据",
  value
}: ReferencePickerProps): ReactElement {
  const scope = useReferenceScope();
  const {
    freeStepTarget,
    options,
    selectValue,
    unresolved
  } = useMemo(() => buildReferenceOptions(scope, value), [scope, value]);

  const select = (
    <Select
      notFoundContent="暂无可引用的数据"
      options={options}
      placeholder={placeholder}
      popupMatchSelectWidth={POPUP_WIDTH}
      showSearch={{ optionFilterProp: ["title"] }}
      status={unresolved ? "warning" : undefined}
      style={selectFullWidth}
      value={selectValue}
      optionRender={option => {
        const { hint } = option.data as Partial<ReferenceOptionItem>;

        return hint === undefined
          ? option.label
          : (
              <span css={optionRowCss}>
                <span css={optionLabelCss}>{option.label}</span>
                <span css={optionHintCss}>{hint}</span>
              </span>
            );
      }}
      onChange={next => {
        if (typeof next === "string") {
          onChange(next);
        }
      }}
    />
  );

  if (freeStepTarget === null) {
    return select;
  }

  return (
    <div css={pickerStackCss}>
      {select}

      <div css={subPathRowCss}>
        <span css={subPathPrefixCss}>字段路径</span>

        <Input
          aria-label="结果属性路径"
          placeholder="可选，留空取完整结果，如 name 或 data.id"
          value={freeStepTarget.subPath}
          onChange={event => onChange(stepPath(freeStepTarget.step, event.target.value.trim().replace(/^\.+/, "")))}
        />
      </div>
    </div>
  );
}
