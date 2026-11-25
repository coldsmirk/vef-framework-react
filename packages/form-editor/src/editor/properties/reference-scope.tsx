import type { SelectProps } from "@vef-framework-react/components";
import type { ReactElement, ReactNode } from "react";

import type { PriorStepSchema } from "../../engine/linkage";
import type { FormVariable, LinkageContextSource } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars, Input, Select } from "@vef-framework-react/components";
import { createContext, use, useMemo } from "react";

import { parseLeafSource } from "../../engine/linkage/scope";

/**
 * Unified candidate model and grouped picker for every scope-path surface in
 * the designer: leaf conditions (and event guards) in `ConditionEditor` and
 * `{ kind: "reference" }` slots in `DynamicValueEditor` (`assign`, `api_call`
 * params, `select_record.source`, `set_fields`, `set_variable`, `alert`,
 * `navigate`). Keeping candidate assembly in one module guarantees conditions
 * and references never diverge on fields, form variables, or system variables.
 */

export interface ReferenceFieldOption {
  value: string;
  label: string;
}

export interface ReferenceScope {
  /**
   * Same-scope keyed fields (`key` → `"标签 · key"`).
   */
  fieldOptions: readonly ReferenceFieldOption[];
  /**
   * Form-global declared variables (`$vars.<name>`).
   */
  variables: readonly FormVariable[];
  /**
   * Host-declared system variables (`$applicant.*`, `$globals.*`, …).
   */
  contextSources: readonly LinkageContextSource[];
  /**
   * Earlier steps' outputs in the current effect sequence (`$steps.<output>`),
   * present only when `allowSteps` is true.
   */
  priorSteps?: readonly PriorStepSchema[];
  allowSteps?: boolean;
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

export function useReferenceScope(): ReferenceScope | null {
  return use(ReferenceScopeContext);
}

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
   * Value passed to `<Select>` — equals `currentPath`, except when
   * `currentPath` drills into an undeclared-fields step (`$steps.info.name`),
   * where the Select holds `"$steps.info"` and {@link freeStepSubPath} carries
   * `"name"` in the companion input.
   */
  selectValue: string | undefined;
  /**
   * Present when the selected value targets a known prior step that has no
   * declared `fields`, letting the designer optionally type a nested property
   * path without writing `$steps.<output>.`.
   */
  freeStepTarget: {
    step: PriorStepSchema;
    subPath: string;
  } | null;
  unresolved: boolean;
}

const VARIABLE_TYPE_LABELS: Record<FormVariable["type"], string> = {
  string: "文本",
  number: "数字",
  boolean: "布尔",
  json: "JSON"
};

/**
 * Assemble grouped options for `<Select>` from one {@link ReferenceScope}, plus
 * resolution metadata for stored paths (including `$form.<key>`, undeclared-field
 * step sub-paths, and unrecognized/dangling paths).
 */
export function buildReferenceOptions(
  scope: ReferenceScope,
  currentPath: string,
  options?: {
    allowStepSubPath?: boolean;
    preferSteps?: boolean;
    flatSingleFieldGroup?: boolean;
  }
): ResolvedReferenceOptions {
  const allowSteps = scope.allowSteps === true;
  const allowStepSubPath = options?.allowStepSubPath ?? allowSteps;
  const preferSteps = options?.preferSteps ?? false;
  const flatSingleFieldGroup = options?.flatSingleFieldGroup ?? false;

  const knownValues = new Set<string>();
  const fieldItems: ReferenceOptionItem[] = scope.fieldOptions.map(field => {
    knownValues.add(field.value);
    return {
      value: field.value,
      label: field.label,
      title: field.label
    };
  });

  const variableItems: ReferenceOptionItem[] = scope.variables
    .filter(variable => variable.name.length > 0)
    .map(variable => {
      const value = `$vars.${variable.name}`;
      knownValues.add(value);
      return {
        value,
        label: variable.name,
        title: `${variable.name} ${VARIABLE_TYPE_LABELS[variable.type]}`,
        hint: VARIABLE_TYPE_LABELS[variable.type]
      };
    });

  const contextItems: ReferenceOptionItem[] = scope.contextSources.map(source => {
    knownValues.add(source.key);
    return {
      value: source.key,
      label: source.label,
      title: `${source.label} ${source.key}`
    };
  });

  const priorSteps = allowSteps ? (scope.priorSteps ?? []) : [];
  const stepByOutput = new Map<string, PriorStepSchema>();
  const stepGroups: ReferenceOptionGroup[] = [];

  for (const step of priorSteps) {
    stepByOutput.set(step.output, step);
    const wholeValue = `$steps.${step.output}`;
    knownValues.add(wholeValue);

    const groupLabel = `步骤 ${step.index + 1} · ${step.label}`;
    const items: ReferenceOptionItem[] = [
      {
        value: wholeValue,
        label: step.kind === "select_record" ? `${step.label}（整条记录）` : `${step.label}（完整结果）`,
        title: `${groupLabel} 完整结果 ${step.output}`,
        hint: step.output
      }
    ];

    for (const field of step.fields) {
      const fieldValue = `$steps.${step.output}.${field.path}`;
      knownValues.add(fieldValue);
      items.push({
        value: fieldValue,
        label: field.label,
        title: `${groupLabel} ${field.label} ${field.path}`,
        hint: field.path
      });
    }

    stepGroups.push({
      label: groupLabel,
      title: groupLabel,
      options: items
    });
  }

  // Resolve how `currentPath` maps onto the option groups.
  let selectValue: string | undefined = currentPath.length > 0 ? currentPath : undefined;
  let freeStepTarget: ResolvedReferenceOptions["freeStepTarget"] = null;
  let unresolved = false;
  const extraMatchedItems: ReferenceOptionItem[] = [];

  if (currentPath.length > 0) {
    const parsed = parseLeafSource(currentPath);

    if (knownValues.has(currentPath)) {
      // Exact match in one of the candidate groups. If it targets a whole step
      // with no declared fields, still offer the sub-path input below.
      if (allowStepSubPath && parsed.kind === "step") {
        const matchedStep = stepByOutput.get(parsed.step);

        if (matchedStep !== undefined && matchedStep.fields.length === 0) {
          freeStepTarget = { step: matchedStep, subPath: "" };
        }
      }
    } else if (parsed.kind === "form" && parsed.path.length === 0) {
      // Recognize explicit `$form.<key>` spelling as the same field option.
      const matchedField = scope.fieldOptions.find(field => field.value === parsed.key);

      if (matchedField === undefined) {
        unresolved = true;
      } else {
        extraMatchedItems.push({
          value: currentPath,
          label: matchedField.label,
          title: `${matchedField.label} ${currentPath}`
        });
      }
    } else if (allowStepSubPath && parsed.kind === "step") {
      const matchedStep = stepByOutput.get(parsed.step);

      if (matchedStep !== undefined && matchedStep.fields.length === 0) {
        selectValue = `$steps.${matchedStep.output}`;
        freeStepTarget = {
          step: matchedStep,
          subPath: parsed.path.join(".")
        };
      } else {
        unresolved = true;
      }
    } else {
      unresolved = true;
    }
  }

  const baseGroups: ReferenceOptionGroup[] = [];

  if (fieldItems.length > 0 || extraMatchedItems.length > 0) {
    baseGroups.push({
      label: "表单字段",
      title: "表单字段",
      options: [...fieldItems, ...extraMatchedItems]
    });
  }

  if (variableItems.length > 0) {
    baseGroups.push({
      label: "表单变量",
      title: "表单变量",
      options: variableItems
    });
  }

  if (contextItems.length > 0) {
    baseGroups.push({
      label: "系统变量",
      title: "系统变量",
      options: contextItems
    });
  }

  const orderedGroups = preferSteps
    ? [...stepGroups, ...baseGroups]
    : [...baseGroups, ...stepGroups];

  const unresolvedItems: ReferenceOptionItem[] = unresolved
    ? [
        {
          value: currentPath,
          label: <span css={unresolvedLabelCss}>{`${currentPath}（未识别）`}</span>,
          title: currentPath
        }
      ]
    : [];

  // Condition pickers keep a flat list when only form fields exist (no
  // variables / system variables / steps), avoiding a redundant single heading.
  const onlyFields = flatSingleFieldGroup
    && variableItems.length === 0
    && contextItems.length === 0
    && stepGroups.length === 0;

  const finalOptions: NonNullable<SelectProps["options"]> = onlyFields
    ? [...fieldItems, ...extraMatchedItems, ...unresolvedItems]
    : [...orderedGroups, ...unresolvedItems];

  return {
    options: finalOptions,
    selectValue,
    freeStepTarget,
    unresolved
  };
}

export interface ReferencePickerProps {
  scope: ReferenceScope;
  value: string;
  placeholder?: string;
  popupMatchSelectWidth?: boolean | number;
  preferSteps?: boolean;
  allowStepSubPath?: boolean;
  flatSingleFieldGroup?: boolean;
  ariaLabel?: string;
  onChange: (path: string) => void;
}

/**
 * Grouped searchable selector for form fields, form variables, host system
 * variables, and earlier step outputs (with automatic sub-path input for steps
 * whose API declares no `fields`). Unrecognized stored paths remain visible
 * with a warning suffix instead of silently vanishing.
 */
export function ReferencePicker({
  allowStepSubPath,
  ariaLabel,
  flatSingleFieldGroup = false,
  onChange,
  placeholder = "选择引用数据",
  popupMatchSelectWidth = 260,
  preferSteps = false,
  scope,
  value
}: ReferencePickerProps): ReactElement {
  const resolved = useMemo(
    () => buildReferenceOptions(scope, value, {
      allowStepSubPath,
      preferSteps,
      flatSingleFieldGroup
    }),
    [scope, value, allowStepSubPath, preferSteps, flatSingleFieldGroup]
  );

  const selectNode = (
    <Select
      aria-label={ariaLabel}
      notFoundContent="暂无可引用的数据"
      options={resolved.options}
      placeholder={placeholder}
      popupMatchSelectWidth={popupMatchSelectWidth}
      showSearch={{ optionFilterProp: ["title"] }}
      status={resolved.unresolved ? "warning" : undefined}
      style={selectFullWidth}
      value={resolved.selectValue}
      optionRender={option => {
        const hint = (option.data as { hint?: string } | undefined)?.hint;

        if (hint === undefined) {
          return option.label;
        }

        return (
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

  if (resolved.freeStepTarget === null) {
    return selectNode;
  }

  const { step, subPath } = resolved.freeStepTarget;

  return (
    <div css={pickerStackCss}>
      {selectNode}

      <div css={subPathRowCss}>
        <span css={subPathPrefixCss}>字段路径</span>

        <Input
          aria-label="结果属性路径"
          placeholder="可选，留空取完整结果，如 name 或 data.id"
          value={subPath}
          onChange={event => {
            const cleaned = event.target.value.trim().replace(/^\.+/, "");

            onChange(cleaned.length > 0 ? `$steps.${step.output}.${cleaned}` : `$steps.${step.output}`);
          }}
        />
      </div>
    </div>
  );
}
