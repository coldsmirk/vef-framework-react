import type { ReactElement, ReactNode } from "react";

import type {
  EvaluationContext,
  FieldPermission,
  FormServices,
  KeyedFormField,
  LinkageEvaluators,
  RuntimeSchema
} from "../types";
import type { EffectSinks, KnownOptionsLookup } from "./effects";
import type { SequenceController } from "./sequence-controller";
import type { RuntimeForm, RuntimeFormValues, RuntimeStateMap } from "./types";

import { useFormStore } from "@vef-framework-react/components";
import { isDeepEqual } from "@vef-framework-react/shared";
import { useEffect, useId, useRef } from "react";

import { isKeyedField } from "../engine/keys";
import { evaluateRuntimeStates, resolveLinkageEvaluators } from "../engine/linkage";
import { isRootScope, walkFields } from "../engine/schema/walk";
import { DataSourceParamScopeProvider } from "../render/data-source-param-scope";
import { EffectDispatchProvider, ScopeIdProvider, useScopeEffects } from "./effects";
import { writeFieldValue } from "./field-write";
import { resolveScopeValues } from "./resolve-scope-values";
import { RuntimeStateContextProvider } from "./runtime-context";
import { stabilizeStateMap } from "./stabilize-state-map";

interface LinkageScopeProps {
  /**
   * Whether the schema binds any data-source parameter to the form. False
   * publishes no parameter scope at all, keeping every option-backed field out
   * of the keystroke render path on a form that has nothing to re-resolve.
   */
  boundParams: boolean;
  children: ReactNode;
  controller: SequenceController;
  disabled: boolean;
  evaluators: LinkageEvaluators | undefined;
  evaluationContext: EvaluationContext | undefined;
  /**
   * Server-resolved permission clamp for THIS scope's keys. Only the root
   * scope carries it — top-level permissions address root-scope keys, so the
   * per-row controllers pass `undefined` (the subform node itself holds the
   * clamp for its whole subtree).
   */
  fieldPermissions: Record<string, FieldPermission> | undefined;
  form: RuntimeForm;
  getKnownOptions: KnownOptionsLookup;
  prefix: string;
  schema: RuntimeSchema;
  services: FormServices | undefined;
  sinks: EffectSinks;
  values: RuntimeFormValues;
}

/**
 * Evaluate `values` into a runtime state map, reference-stabilize it against the
 * previous map, publish it through the selector context, and run scoped
 * assignments. Renders only the Provider wrapping its (stable) children, so its
 * own re-render on every value change produces NO field-tree cascade — only the
 * fields whose state object reference actually changed re-render. Shared by the
 * root and per-row controllers.
 */
function LinkageScope({
  boundParams,
  children,
  controller,
  disabled,
  evaluators,
  evaluationContext,
  fieldPermissions,
  form,
  getKnownOptions,
  prefix,
  schema,
  services,
  sinks,
  values
}: LinkageScopeProps): ReactElement {
  // Stable per-mount scope identity: stays pinned to a subform row even when
  // an earlier row is removed and this row's `prefix` shifts (`lines[1].` →
  // `lines[0].`), so single-flight slots and busy indicators follow the row.
  const scopeId = useId();
  const prevRef = useRef<RuntimeStateMap>(undefined);
  const next = evaluateRuntimeStates(schema, values, {
    evaluators,
    evaluationContext,
    fieldPermissions
  });
  const stateMap = stabilizeStateMap(prevRef.current, next);
  prevRef.current = stateMap;

  const appliedAssignsRef = useRef<{ schema: RuntimeSchema; applied: Map<string, unknown> } | null>(null);

  if (appliedAssignsRef.current === null || appliedAssignsRef.current.schema !== schema) {
    appliedAssignsRef.current = { schema, applied: new Map() };
  }

  const appliedAssignedValues = appliedAssignsRef.current.applied;

  const runSequences = useScopeEffects({
    controller,
    disabled,
    evaluators,
    evaluationContext,
    fieldPermissions,
    form,
    getKnownOptions,
    prefix,
    schema,
    scopeId,
    services,
    sinks,
    values
  });

  const getKnownOptionsRef = useRef(getKnownOptions);
  getKnownOptionsRef.current = getKnownOptions;
  const evaluationContextRef = useRef(evaluationContext);
  evaluationContextRef.current = evaluationContext;
  const evaluatorsRef = useRef(evaluators);
  evaluatorsRef.current = evaluators;

  useEffect(() => {
    if (disabled) {
      return;
    }

    const resolvedEvaluators = resolveLinkageEvaluators(evaluatorsRef.current);

    applyScopedAssignments({
      appliedAssignedValues,
      disabled,
      evaluationContext: evaluationContextRef.current,
      evaluators: resolvedEvaluators,
      fieldPermissions,
      form,
      getKnownOptions: getKnownOptionsRef.current,
      prefix,
      schema,
      stateMap
    });
  }, [appliedAssignedValues, disabled, fieldPermissions, form, prefix, schema, stateMap]);

  return (
    <ScopeIdProvider scopeId={scopeId}>
      <RuntimeStateContextProvider value={stateMap}>
        <EffectDispatchProvider run={runSequences}>
          <DataSourceParamScopeProvider
            context={evaluationContext}
            evaluators={evaluators}
            values={boundParams ? values : undefined}
          >
            {children}
          </DataSourceParamScopeProvider>
        </EffectDispatchProvider>
      </RuntimeStateContextProvider>
    </ScopeIdProvider>
  );
}

/**
 * Root runtime-state controller: the only React subscriber to the whole
 * form-values object. `form.store.state.values` is one shared reference per
 * write, so the default `Object.is` compare on the selector is correct here.
 */
export function RuntimeStateController({
  boundParams,
  children,
  controller,
  disabled,
  evaluators,
  evaluationContext,
  fieldPermissions,
  form,
  getKnownOptions,
  schema,
  services,
  sinks
}: {
  boundParams: boolean;
  children: ReactNode;
  controller: SequenceController;
  disabled: boolean;
  evaluators: LinkageEvaluators | undefined;
  evaluationContext: EvaluationContext | undefined;
  fieldPermissions: Record<string, FieldPermission> | undefined;
  form: RuntimeForm;
  getKnownOptions: KnownOptionsLookup;
  schema: RuntimeSchema;
  services: FormServices | undefined;
  sinks: EffectSinks;
}): ReactElement {
  const values = useFormStore(form.store, state => state.values);

  return (
    <LinkageScope
      boundParams={boundParams}
      controller={controller}
      disabled={disabled}
      evaluationContext={evaluationContext}
      evaluators={evaluators}
      fieldPermissions={fieldPermissions}
      form={form}
      getKnownOptions={getKnownOptions}
      prefix=""
      schema={schema}
      services={services}
      sinks={sinks}
      values={values}
    >
      {children}
    </LinkageScope>
  );
}

/**
 * Per-subform-row controller. Subscribes to ONLY this row's value slice — deep
 * compared, because `resolveScopeValues` returns a fresh object each call — so
 * it re-evaluates when this row's record changes, not on every keystroke
 * elsewhere. Installs a NESTED selector-context Provider so the template field
 * ids (which repeat across rows) resolve to this row's own state map.
 */
export function SubformRowController({
  boundParams,
  children,
  controller,
  disabled,
  evaluators,
  evaluationContext,
  form,
  getKnownOptions,
  prefix,
  services,
  sinks,
  templateSchema
}: {
  boundParams: boolean;
  children: ReactNode;
  controller: SequenceController;
  disabled: boolean;
  evaluators: LinkageEvaluators | undefined;
  evaluationContext: EvaluationContext | undefined;
  form: RuntimeForm;
  getKnownOptions: KnownOptionsLookup;
  prefix: string;
  services: FormServices | undefined;
  sinks: EffectSinks;
  templateSchema: RuntimeSchema;
}): ReactElement {
  const rowValues = useFormStore(
    form.store,
    state => resolveScopeValues(state.values, prefix),
    isDeepEqual
  );

  return (
    <LinkageScope
      boundParams={boundParams}
      controller={controller}
      disabled={disabled}
      evaluationContext={evaluationContext}
      evaluators={evaluators}
      // Top-level permissions clamp the subform node itself, never a template
      // field individually — a row scope always evaluates unclamped.
      fieldPermissions={undefined}
      form={form}
      getKnownOptions={getKnownOptions}
      prefix={prefix}
      schema={templateSchema}
      services={services}
      sinks={sinks}
      values={rowValues}
    >
      {children}
    </LinkageScope>
  );
}

function applyScopedAssignments(args: {
  appliedAssignedValues: Map<string, unknown>;
  disabled: boolean;
  evaluationContext: EvaluationContext | undefined;
  evaluators: Required<LinkageEvaluators>;
  fieldPermissions: Record<string, FieldPermission> | undefined;
  form: RuntimeForm;
  getKnownOptions: KnownOptionsLookup;
  prefix: string;
  schema: RuntimeSchema;
  stateMap: RuntimeStateMap;
}): void {
  const assignments: Array<{ field: KeyedFormField; value: unknown }> = [];

  walkFields(args.schema, (field, scope) => {
    if (!isRootScope(scope) || !isKeyedField(field)) {
      return;
    }

    const runtimeState = args.stateMap[field.id];

    if (!runtimeState?.assigned) {
      args.appliedAssignedValues.delete(field.id);

      return;
    }

    if (args.appliedAssignedValues.has(field.id)
      && Object.is(args.appliedAssignedValues.get(field.id), runtimeState.assignedValue)) {
      return;
    }

    args.appliedAssignedValues.set(field.id, runtimeState.assignedValue);

    if (isDeepEqual(args.form.getFieldValue(`${args.prefix}${field.key}`), runtimeState.assignedValue)) {
      return;
    }

    assignments.push({ field, value: runtimeState.assignedValue });
  });

  if (assignments.length === 0) {
    return;
  }

  const scopeValues = resolveScopeValues(args.form.store.state.values, args.prefix);

  for (const assignment of assignments) {
    writeFieldValue({
      disabled: args.disabled,
      fieldPermissions: args.fieldPermissions,
      form: args.form,
      key: assignment.field.key,
      knownOptions: args.getKnownOptions(assignment.field, scopeValues, args.evaluationContext, args.evaluators),
      prefix: args.prefix,
      targetField: assignment.field,
      value: assignment.value
    });
  }
}
