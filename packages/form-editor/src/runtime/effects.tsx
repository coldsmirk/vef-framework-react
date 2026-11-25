import type { ReactElement, ReactNode } from "react";

import type { ConditionEffectRule, TriggerEffectSequence } from "../engine/linkage";
import type { EvaluationContext, FieldPermission, FormServices, LinkageEvaluators, RuntimeSchema } from "../types";
import type { EffectSinks, KnownOptionsLookup } from "./action-executor";
import type { SequenceController } from "./sequence-controller";
import type { RuntimeForm, RuntimeFormValues } from "./types";

import { isDeepEqual } from "@vef-framework-react/shared";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import {
  collectConditionEffectRules,
  evaluateConditionEffectTruths,
  resolveLinkageEvaluators
} from "../engine/linkage";
import { executeActionSequence } from "./action-executor";

export type { EffectSinks, KnownOptionsLookup, RefreshDataSource, ResetForm, SetVariable, SubmitForm } from "./action-executor";

/**
 * Dispatch one or more trigger-matched rule sequences within a value scope.
 * `ownerFieldId` identifies the field that owns the triggering rule so an
 * in-flight `api_call` displays a busy indicator on that field alone.
 */
export type RunSequences = (sequences: readonly TriggerEffectSequence[], ownerFieldId?: string) => void;

const noopRunSequences: RunSequences = () => {
  // No provider above: an unscoped field dispatches into the void.
};

const RunSequencesContext = createContext<RunSequences>(noopRunSequences);
RunSequencesContext.displayName = "RunSequencesContext";

const SequenceControllerContext = createContext<SequenceController | null>(null);
SequenceControllerContext.displayName = "SequenceControllerContext";

const ScopeIdContext = createContext<string>("");
ScopeIdContext.displayName = "ScopeIdContext";

const FieldIdContext = createContext<string | undefined>(undefined);
FieldIdContext.displayName = "FieldIdContext";

function noopUnsubscribe(): void {
  // Outside a runtime provider there is no controller to subscribe to.
}

function noopSubscribe(): () => void {
  return noopUnsubscribe;
}

export function SequenceControllerProvider({
  children,
  controller
}: {
  children: ReactNode;
  controller: SequenceController;
}): ReactElement {
  return <SequenceControllerContext value={controller}>{children}</SequenceControllerContext>;
}

export function ScopeIdProvider({
  children,
  scopeId
}: {
  children: ReactNode;
  scopeId: string;
}): ReactElement {
  return <ScopeIdContext value={scopeId}>{children}</ScopeIdContext>;
}

export function FieldIdProvider({
  children,
  fieldId
}: {
  children: ReactNode;
  fieldId: string;
}): ReactElement {
  return <FieldIdContext value={fieldId}>{children}</FieldIdContext>;
}

/**
 * Whether `fieldId` (defaulting to the enclosing `FormFieldRenderer`'s field)
 * currently has an in-flight `api_call` from one of its own rules in this
 * value scope. Backed by `useSyncExternalStore` returning a primitive boolean,
 * so only the busy field itself re-renders when a request starts or ends.
 */
export function useFieldBusy(fieldId?: string): boolean {
  const controller = use(SequenceControllerContext);
  const scopeId = use(ScopeIdContext);
  const contextFieldId = use(FieldIdContext);
  const targetId = fieldId ?? contextFieldId;

  return useSyncExternalStore(
    controller?.subscribeBusy ?? noopSubscribe,
    () => controller !== null && targetId !== undefined && controller.getBusyCount(scopeId, targetId) > 0,
    () => false
  );
}

/**
 * Read the nearest value scope's sequence dispatcher (root form or subform row).
 */
export function useEffectDispatch(): RunSequences {
  return use(RunSequencesContext);
}

export function EffectDispatchProvider({ children, run }: { children: ReactNode; run: RunSequences }): ReactElement {
  return <RunSequencesContext value={run}>{children}</RunSequencesContext>;
}

/**
 * Run form-scope effect sequences (`load` / `beforeSubmit` / `afterSubmit`) in
 * declaration order against the root value scope. Returns a Promise that
 * resolves once every sequence finishes (or rejects when `propagateErrors` is
 * set and a sequence fails).
 */
export async function dispatchFormSequences(args: {
  controller: SequenceController;
  disabled: boolean;
  evaluators: LinkageEvaluators | undefined;
  evaluationContext: EvaluationContext | undefined;
  fieldPermissions: Record<string, FieldPermission> | undefined;
  form: RuntimeForm;
  getKnownOptions: KnownOptionsLookup;
  propagateErrors?: boolean;
  schema: RuntimeSchema;
  scopeId: string;
  sequences: readonly TriggerEffectSequence[];
  services: FormServices | undefined;
  sinks: EffectSinks;
}): Promise<void> {
  if (args.sequences.length === 0) {
    return;
  }

  const resolved = resolveLinkageEvaluators(args.evaluators);

  for (const sequence of args.sequences) {
    const result = executeActionSequence({
      actions: sequence.actions,
      controller: args.controller,
      disabled: args.disabled,
      evaluators: resolved,
      form: args.form,
      getEvaluationContext: () => args.evaluationContext,
      getFieldPermissions: () => args.fieldPermissions,
      getKnownOptions: args.getKnownOptions,
      getPrefix: () => "",
      propagateErrors: args.propagateErrors,
      ruleId: sequence.ruleId,
      schema: args.schema,
      scopeId: args.scopeId,
      services: args.services,
      sinks: args.sinks,
      when: sequence.when
    });

    if (result !== undefined) {
      await result;
    }
  }
}

function inputSignature(rule: ConditionEffectRule, values: RuntimeFormValues): unknown[] | null {
  if (rule.opaque) {
    return null;
  }

  return rule.sourceKeys.map(key => values[key]);
}

/**
 * Per-scope side-effect runtime: builds the stable {@link RunSequences}
 * dispatcher for this value scope, runs condition-triggered effect rules on
 * rising edge (or on every tracked input change when `retrigger === "always"`),
 * and aborts all in-flight runs owned by this scope when it unmounts (e.g. a
 * subform row is deleted).
 */
export function useScopeEffects(args: {
  controller: SequenceController;
  disabled: boolean;
  evaluators: LinkageEvaluators | undefined;
  evaluationContext: EvaluationContext | undefined;
  fieldPermissions: Record<string, FieldPermission> | undefined;
  form: RuntimeForm;
  getKnownOptions: KnownOptionsLookup;
  prefix: string;
  schema: RuntimeSchema;
  scopeId: string;
  services: FormServices | undefined;
  sinks: EffectSinks;
  values: RuntimeFormValues;
}): RunSequences {
  const {
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
  } = args;

  const resolved = useMemo(() => resolveLinkageEvaluators(evaluators), [evaluators]);
  const conditionRules = useMemo(() => collectConditionEffectRules(schema), [schema]);

  const truthsRef = useRef<boolean[] | null>(null);
  const signaturesRef = useRef<Array<unknown[] | null> | null>(null);
  const previousValuesRef = useRef<RuntimeFormValues | null>(null);
  const rulesRef = useRef(conditionRules);

  if (rulesRef.current !== conditionRules) {
    rulesRef.current = conditionRules;
    truthsRef.current = null;
    signaturesRef.current = null;
  }

  // Keep volatile inputs in refs so `runSequences` keeps a stable identity
  // across `$vars` writes, permission map churn, and subform index shifts —
  // preserving every memoized FieldSlot while still reading live values at
  // step execution time.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const evaluationContextRef = useRef(evaluationContext);
  evaluationContextRef.current = evaluationContext;

  const fieldPermissionsRef = useRef(fieldPermissions);
  fieldPermissionsRef.current = fieldPermissions;

  const getKnownOptionsRef = useRef(getKnownOptions);
  getKnownOptionsRef.current = getKnownOptions;

  const prefixRef = useRef(prefix);
  prefixRef.current = prefix;

  const servicesRef = useRef(services);
  servicesRef.current = services;

  // Abort every in-flight sequence owned by this scope when it unmounts (e.g.
  // a subform row is removed) without affecting surviving sibling rows.
  useEffect(() => () => {
    controller.abortScope(scopeId);
  }, [controller, scopeId]);

  const runSequences = useCallback<RunSequences>(
    (sequences, ownerFieldId) => {
      for (const sequence of sequences) {
        if (sequence.actions.length === 0) {
          continue;
        }

        const result = executeActionSequence({
          actions: sequence.actions,
          controller,
          disabled: disabledRef.current,
          evaluators: resolved,
          form,
          getEvaluationContext: () => evaluationContextRef.current,
          getFieldPermissions: () => fieldPermissionsRef.current,
          getKnownOptions: (...lookupArgs) => getKnownOptionsRef.current(...lookupArgs),
          getPrefix: () => prefixRef.current,
          ownerFieldId,
          ruleId: sequence.ruleId,
          schema,
          scopeId,
          services: servicesRef.current,
          sinks,
          when: sequence.when
        });

        // Fire-and-forget for event / condition triggers: contain unexpected
        // rejections so they never surface as unhandled promise rejections.
        if (result !== undefined) {
          result.catch((error: unknown) => {
            console.error("[form-editor] effect sequence failed:", error);
          });
        }
      }
    },
    [controller, form, resolved, schema, scopeId, sinks]
  );

  useEffect(() => {
    if (conditionRules.length === 0) {
      return;
    }

    const truths = evaluateConditionEffectTruths(conditionRules, values, resolved, evaluationContext);
    const signatures = conditionRules.map(
      rule => rule.retrigger === "always" ? inputSignature(rule, values) : null
    );
    const previousTruths = truthsRef.current;
    const previousSignatures = signaturesRef.current;
    const previousValues = previousValuesRef.current;

    truthsRef.current = truths;
    signaturesRef.current = signatures;
    previousValuesRef.current = values;

    // Seed on first run so a condition already true on mount does not fire.
    if (!previousTruths) {
      return;
    }

    for (const [index, rule] of conditionRules.entries()) {
      const truth = truths[index];

      if (!truth) {
        continue;
      }

      const previousTruth = previousTruths[index];

      if (!previousTruth) {
        runSequences([{ ruleId: rule.ruleId, actions: rule.actions }], rule.ownerId);
      } else if (rule.retrigger === "always") {
        const changed = signatures[index] === null
          ? values !== previousValues
          : !isDeepEqual(signatures[index], previousSignatures?.[index]);

        if (changed) {
          runSequences([{ ruleId: rule.ruleId, actions: rule.actions }], rule.ownerId);
        }
      }
    }
  }, [values, conditionRules, resolved, evaluationContext, runSequences]);

  return runSequences;
}
