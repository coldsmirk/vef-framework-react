import type { ReactElement, ReactNode } from "react";

import type { ConditionEffectRule, TriggerEffectSequence } from "../engine/linkage";
import type { EvaluationContext, LinkageEvaluators, RuntimeSchema } from "../types";
import type { SequenceEnv, SequenceOutcome } from "./action-executor";
import type { SequenceController } from "./sequence-controller";
import type { RuntimeFormValues } from "./types";

import { isDeepEqual } from "@vef-framework-react/shared";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import {
  collectConditionEffectRules,
  evaluateConditionEffectTruths,
  resolveLinkageEvaluators
} from "../engine/linkage";
import { executeActionSequence } from "./action-executor";

export type {
  EffectSinks,
  KnownOptionsLookup,
  RefreshDataSource,
  ResetForm,
  SequenceEnv,
  SequenceOutcome,
  SetVariable,
  SubmitForm
} from "./action-executor";

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
 * Read the nearest value scope's sequence dispatcher. A field reads this to
 * fire its own event-triggered sequences (`change` / `commit` / `focus` /
 * `blur` / `click`); the nearest provider is the field's value scope (root form
 * or subform row), so a subform field's sequences run against that row's
 * record.
 */
export function useEffectDispatch(): RunSequences {
  return use(RunSequencesContext);
}

/**
 * Publishes a scope's {@link RunSequences} to its descendant fields. Installed
 * by `LinkageScope` alongside the runtime-state context.
 */
export function EffectDispatchProvider({ children, run }: { children: ReactNode; run: RunSequences }): ReactElement {
  return <RunSequencesContext value={run}>{children}</RunSequencesContext>;
}

/**
 * Run form-scope effect sequences (`load` / `beforeSubmit` / `afterSubmit`) in
 * declaration order against the root value scope.
 *
 * Returns a {@link SequenceOutcome}: `"completed"` when every sequence
 * completes normally (including false `when` guards and `onError: "continue"`),
 * or the first non-completed outcome (`"stopped"`, `"aborted"`, `"failed"`)
 * when `stopOnIncomplete` is set (`beforeSubmit`).
 */
export async function dispatchFormSequences(args: {
  env: SequenceEnv;
  schema: RuntimeSchema;
  scopeId: string;
  sequences: readonly TriggerEffectSequence[];
  stopOnIncomplete?: boolean;
}): Promise<SequenceOutcome> {
  if (args.sequences.length === 0) {
    return "completed";
  }

  for (const sequence of args.sequences) {
    const outcome = await executeActionSequence({
      actions: sequence.actions,
      env: args.env,
      getPrefix: () => "",
      ruleId: sequence.ruleId,
      schema: args.schema,
      scopeId: args.scopeId,
      when: sequence.when
    });

    if (args.stopOnIncomplete && outcome !== "completed") {
      return outcome;
    }
  }

  return "completed";
}

/**
 * The source values a rule's `always`-retrigger sequence depends on, captured
 * as a positional tuple so the tracker can tell a real source-field change from
 * an unrelated one (the effect re-runs on every value change, but `always`
 * rules must only repeat when *their* input moved). Compared with
 * {@link isDeepEqual}, so it captures the raw values directly — a
 * `JSON.stringify` fingerprint conflated `undefined` with `null`/absence and
 * threw on `BigInt` or cyclic values. `null` means "no tracked keys" — an
 * opaque `expression` condition, which re-fires on any actual *value* change
 * while it holds (the detector diffs the `values` reference for those — see
 * {@link useScopeEffects}). Reads keys the same way `matchLeaf` does (flat
 * `values[key]`), so the tuple tracks exactly what the condition evaluates.
 */
function inputSignature(rule: ConditionEffectRule, values: RuntimeFormValues): unknown[] | null {
  // Only an opaque condition gets the "diff the whole values object" fallback.
  // An enumerable condition with no form-value keys — one reading a `$`-rooted
  // context path — has a STABLE empty signature, so its `always` rule repeats
  // when the context changes the rule's truth, not on every keystroke.
  if (rule.opaque) {
    return null;
  }

  return rule.sourceKeys.map(key => values[key]);
}

/**
 * Per-scope side-effect runtime: builds the stable {@link RunSequences}
 * dispatcher for this value scope (used by both event-triggered fields and the
 * condition-edge detector), fires each condition-effect rule's sequence on the
 * false→true rising edge (repeating on tracked source changes when
 * `retrigger === "always"`), and aborts all in-flight runs owned by this scope
 * when it unmounts (e.g. a subform row is deleted).
 *
 * Mirrors `LinkageScope`'s scoping — root or one subform row — so each row
 * tracks its own edges and dispatches against its own record. Edge detection
 * runs in an effect (never in render) so the render path stays pure, matching
 * `LinkageScope`'s assignment effect.
 */
export function useScopeEffects(args: {
  applyPermissions: boolean;
  disabled: boolean;
  env: SequenceEnv;
  evaluationContext: EvaluationContext | undefined;
  evaluators: LinkageEvaluators | undefined;
  prefix: string;
  schema: RuntimeSchema;
  scopeId: string;
  values: RuntimeFormValues;
}): RunSequences {
  const {
    applyPermissions,
    disabled,
    env,
    evaluationContext,
    evaluators,
    prefix,
    schema,
    scopeId,
    values
  } = args;

  const resolved = useMemo(() => resolveLinkageEvaluators(evaluators), [evaluators]);
  const conditionRules = useMemo(() => collectConditionEffectRules(schema), [schema]);

  // Previous truth of each condition-effect rule, positionally aligned with
  // `conditionRules`. `null` until the first evaluation seeds it.
  const truthsRef = useRef<boolean[] | null>(null);
  // Previous source-value tuple of each rule, positionally aligned with
  // `conditionRules` (a `null` entry for `edge` rules and opaque conditions).
  // Lets the `always` lane tell a real source-field change from an unrelated
  // one (compared with `isDeepEqual`). Seeded together with `truthsRef`.
  const signaturesRef = useRef<Array<unknown[] | null> | null>(null);
  // The `values` reference seen by the previous detection run. The detection
  // effect also re-runs when non-value deps move (`$vars` via the expression
  // context, a new dispatcher identity); the opaque-condition `always` lane
  // diffs this ref so it re-fires only on an actual form-value change — which
  // also keeps a StrictMode double-invoked mount (same `values`) silent.
  const previousValuesRef = useRef<RuntimeFormValues | null>(null);
  // When the rule set changes (a schema swap), the old vectors no longer align;
  // clearing them re-seeds, so a condition already true under the new schema
  // does not fire spuriously. Written in render (idempotent) so it lands before
  // the detection effect reads it.
  const rulesRef = useRef(conditionRules);

  if (rulesRef.current !== conditionRules) {
    rulesRef.current = conditionRules;
    truthsRef.current = null;
    signaturesRef.current = null;
  }

  // Keep scope-local volatile inputs in refs so `scopeEnv` and `runSequences`
  // keep stable identities across container disabled flips and subform index
  // shifts while still reading live values on every step.
  const scopeDisabledRef = useRef(disabled);
  scopeDisabledRef.current = disabled;

  const prefixRef = useRef(prefix);
  prefixRef.current = prefix;

  const scopeEnv = useMemo<SequenceEnv>(
    () => {
      return {
        controller: env.controller,
        form: env.form,
        sinks: env.sinks,
        getDisabled: () => env.getDisabled() || scopeDisabledRef.current,
        getEvaluationContext: () => env.getEvaluationContext(),
        getEvaluators: () => env.getEvaluators(),
        getFieldPermissions: () => applyPermissions ? env.getFieldPermissions() : undefined,
        getKnownOptions: (...lookupArgs) => env.getKnownOptions(...lookupArgs),
        getServices: () => env.getServices()
      };
    },
    [applyPermissions, env]
  );

  // Abort every in-flight sequence owned by this scope when it unmounts (e.g.
  // a subform row is removed) without affecting surviving sibling rows.
  useEffect(() => () => {
    env.controller.abortScope(scopeId);
  }, [env.controller, scopeId]);

  const runSequences = useCallback<RunSequences>(
    (sequences, ownerFieldId) => {
      for (const sequence of sequences) {
        if (sequence.actions.length === 0) {
          continue;
        }

        // Fire-and-forget: an event or condition trigger has no use for the
        // outcome, and the executor never throws or rejects.
        void executeActionSequence({
          actions: sequence.actions,
          env: scopeEnv,
          getPrefix: () => prefixRef.current,
          ownerFieldId,
          ruleId: sequence.ruleId,
          schema,
          scopeId,
          when: sequence.when
        });
      }
    },
    [schema, scopeEnv, scopeId]
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

    // Seed on the first run so a condition already true on mount does not fire;
    // only a later change triggers the sequence thereafter.
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
        // Rising edge (false→true): run the rule's sequence once.
        runSequences([{ ruleId: rule.ruleId, actions: rule.actions }], rule.ownerId);
      } else if (rule.retrigger === "always") {
        // Still holding past the rising edge: repeat the sequence when a
        // tracked source field changed since the last evaluation. A `null`
        // signature (opaque expression condition) has no tracked keys, so it
        // re-fires on any actual value change — the `values` reference moving —
        // but NOT on a re-run driven by other deps (a `set_variable` updating
        // the evaluation context must not re-fire the very rule that wrote it).
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
