import type { ReactElement, ReactNode } from "react";

import type { ExpressionContext, LinkageEvaluators, RuntimeSchema } from "../types";
import type { EffectSinks } from "./effects";
import type { RuntimeForm, RuntimeFormValues, RuntimeStateMap } from "./types";

import { useFormStore } from "@vef-framework-react/components";
import { isDeepEqual } from "@vef-framework-react/shared";
import { useEffect, useRef } from "react";

import { isKeyedField } from "../engine/keys";
import { evaluateRuntimeStates } from "../engine/linkage";
import { isRootScope, walkFields } from "../engine/schema/walk";
import { EffectDispatchProvider, useScopeEffects } from "./effects";
import { resolveScopeValues } from "./resolve-scope-values";
import { RuntimeStateContextProvider } from "./runtime-context";
import { stabilizeStateMap } from "./stabilize-state-map";

interface LinkageScopeProps {
  children: ReactNode;
  evaluators: LinkageEvaluators | undefined;
  expressionContext: ExpressionContext | undefined;
  form: RuntimeForm;
  prefix: string;
  schema: RuntimeSchema;
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
  children,
  evaluators,
  expressionContext,
  form,
  prefix,
  schema,
  sinks,
  values
}: LinkageScopeProps): ReactElement {
  const prevRef = useRef<RuntimeStateMap>(undefined);
  // Computed during render (not in an effect) so the first paint already has
  // default-driven hide/disable/require applied — the selector-context Provider
  // seeds its store synchronously from this value on mount, avoiding a flash.
  //
  // Mutating `prevRef` in render is only safe because `stabilizeStateMap` is
  // idempotent under self-composition: re-running it with its own output as
  // `prev` and a deeply-equal `next` returns that output unchanged. So a
  // StrictMode double-render (or a discarded concurrent render) leaves `prevRef`
  // self-consistent. KEEP the render path side-effect-free — the only write
  // (`form.setFieldValue`) lives in the effect below; never add logging,
  // counters, or external writes here, or that safety breaks.
  const next = evaluateRuntimeStates(schema, values, { evaluators, expressionContext });
  const stateMap = stabilizeStateMap(prevRef.current, next);
  prevRef.current = stateMap;

  // Last APPLIED `assign` value per field id, backing the "computed but
  // editable" semantic (see `applyScopedAssignments`). Re-seeded when the
  // scope's schema (and so its rule set) swaps — mirroring the effect lane's
  // edge-tracker reset — so the new schema's assignments apply afresh. Written
  // in render (idempotent) so it lands before the assignment effect reads it.
  const appliedAssignsRef = useRef<{ schema: RuntimeSchema; applied: Map<string, unknown> } | null>(null);

  if (appliedAssignsRef.current === null || appliedAssignsRef.current.schema !== schema) {
    appliedAssignsRef.current = { schema, applied: new Map() };
  }

  const appliedAssignedValues = appliedAssignsRef.current.applied;

  // Side-effect lane: condition rising-edge detection + the event dispatcher
  // published to descendant fields. Same scope (root / row), same `values`.
  const runEffects = useScopeEffects({
    evaluators,
    expressionContext,
    form,
    prefix,
    schema,
    sinks,
    values
  });

  useEffect(() => {
    applyScopedAssignments({
      appliedAssignedValues,
      form,
      prefix,
      schema,
      stateMap
    });
  }, [appliedAssignedValues, form, prefix, schema, stateMap]);

  return (
    <RuntimeStateContextProvider value={stateMap}>
      <EffectDispatchProvider run={runEffects}>{children}</EffectDispatchProvider>
    </RuntimeStateContextProvider>
  );
}

/**
 * Root runtime-state controller: the only React subscriber to the whole
 * form-values object. `form.store.state.values` is one shared reference per
 * write, so the default `Object.is` compare on the selector is correct here.
 */
export function RuntimeStateController({
  children,
  evaluators,
  expressionContext,
  form,
  schema,
  sinks
}: {
  children: ReactNode;
  evaluators: LinkageEvaluators | undefined;
  expressionContext: ExpressionContext | undefined;
  form: RuntimeForm;
  schema: RuntimeSchema;
  sinks: EffectSinks;
}): ReactElement {
  const values = useFormStore(form.store, state => state.values);

  return (
    <LinkageScope
      evaluators={evaluators}
      expressionContext={expressionContext}
      form={form}
      prefix=""
      schema={schema}
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
  children,
  evaluators,
  expressionContext,
  form,
  prefix,
  sinks,
  templateSchema
}: {
  children: ReactNode;
  evaluators: LinkageEvaluators | undefined;
  expressionContext: ExpressionContext | undefined;
  form: RuntimeForm;
  prefix: string;
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
      evaluators={evaluators}
      expressionContext={expressionContext}
      form={form}
      prefix={prefix}
      schema={templateSchema}
      sinks={sinks}
      values={rowValues}
    >
      {children}
    </LinkageScope>
  );
}

/**
 * Write pending `assign` values into the form for the root-scope fields of
 * `schema`, addressing each field as `${prefix}${key}`. {@link LinkageScope}
 * calls this with `prefix: ""` for the root form and with the row prefix
 * (e.g. `"lines[0]."`) for each subform row, so assignments work the same at
 * every value scope.
 *
 * An assigned field is **computed but editable**: the assignment is applied
 * once per change of the *computed* value, not re-asserted on every effect run.
 * `appliedAssignedValues` records the last applied value per field id, and a
 * field is written only when its rule's computed value differs from that record
 * — so a user's manual override sticks while unrelated runtime states flip, and
 * is replaced exactly when the computed value itself changes. The `Object.is`
 * compare is sound for recomputed-but-equal objects because `stabilizeStateMap`
 * preserves the previous state entry (and so the previous `assignedValue`
 * reference) whenever an evaluation is deeply equal.
 */
function applyScopedAssignments(args: {
  appliedAssignedValues: Map<string, unknown>;
  form: RuntimeForm;
  prefix: string;
  schema: RuntimeSchema;
  stateMap: RuntimeStateMap;
}): void {
  const assignments: Array<{ name: string; value: unknown }> = [];

  walkFields(args.schema, (field, scope) => {
    if (!isRootScope(scope) || !isKeyedField(field)) {
      return;
    }

    const runtimeState = args.stateMap[field.id];

    if (!runtimeState?.assigned) {
      return;
    }

    // Already applied this computed value once — the user may have edited the
    // field since, and that edit must stick.
    if (args.appliedAssignedValues.has(field.id)
      && Object.is(args.appliedAssignedValues.get(field.id), runtimeState.assignedValue)) {
      return;
    }

    args.appliedAssignedValues.set(field.id, runtimeState.assignedValue);

    const name = `${args.prefix}${field.key}`;

    // The field may already hold the computed value (e.g. a matching default):
    // record it as applied above, but skip the redundant write.
    if (isDeepEqual(args.form.getFieldValue(name), runtimeState.assignedValue)) {
      return;
    }

    assignments.push({ name, value: runtimeState.assignedValue });
  });

  if (assignments.length === 0) {
    return;
  }

  for (const assignment of assignments) {
    args.form.setFieldValue(assignment.name, assignment.value, {
      dontRunListeners: true,
      dontUpdateMeta: true,
      dontValidate: false
    });
  }
}
