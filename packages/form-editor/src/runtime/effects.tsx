import type { ReactElement, ReactNode } from "react";

import type { EffectAction, EffectDispatchContext, EvaluationContext, LinkageEvaluators, RuntimeSchema } from "../types";
import type { RuntimeForm, RuntimeFormValues } from "./types";

import { isDeepEqual } from "@vef-framework-react/shared";
import { createContext, use, useCallback, useEffect, useMemo, useRef } from "react";

import { exhaustive } from "../engine/assert-never";
import {
  collectConditionEffectRules,
  evaluateConditionEffectTruths,
  resolveActionValue,
  resolveLinkageEvaluators
} from "../engine/linkage";
import { resolveScopeValues } from "./resolve-scope-values";

/**
 * Run a list of effect actions in one value scope (root form or subform row).
 */
export type RunEffects = (actions: EffectAction[]) => void;

/**
 * Write a form-global variable (`$vars`). Owned by `FormRenderer`'s reactive
 * variable store; a `set_variable` effect calls it.
 */
export type SetVariable = (name: string, value: unknown) => void;

/**
 * Re-resolve a form-global data source by id. Owned by `FormRenderer`'s
 * data-source version store; a `refresh_data_source` effect calls it, bumping a
 * nonce so every field referencing that source re-fetches (see `useFieldOptions`).
 */
export type RefreshDataSource = (dataSourceId: string) => void;

/**
 * The renderer-owned imperative sinks the effect lane writes to, beyond the form
 * api itself. Bundled into one object so a new native effect adds a field here,
 * not another callback threaded through every value scope and lifecycle hook.
 */
export interface EffectSinks {
  setVariable: SetVariable;
  refreshDataSource: RefreshDataSource;
}

const noopRunEffects: RunEffects = () => {
  // No provider above: an unscoped field dispatches into the void.
};

const RunEffectsContext = createContext<RunEffects>(noopRunEffects);
RunEffectsContext.displayName = "RunEffectsContext";

/**
 * Read the nearest value scope's effect dispatcher. A field reads this to fire
 * its own event-triggered effects (`change` / `focus` / `blur` / `click`); the
 * nearest provider is the field's value scope (root form or subform row), so a
 * subform field's effects run against that row's record.
 */
export function useEffectDispatch(): RunEffects {
  return use(RunEffectsContext);
}

/**
 * Publishes a scope's {@link RunEffects} to its descendant fields. Installed by
 * `LinkageScope` alongside the runtime-state context.
 */
export function EffectDispatchProvider({ children, run }: { children: ReactNode; run: RunEffects }): ReactElement {
  return <RunEffectsContext value={run}>{children}</RunEffectsContext>;
}

/**
 * Execute effect actions. `set_field` / `submit` / `reset` are handled natively
 * against the form api (the runtime owns it); `alert` / `api_call` / `navigate`
 * are delegated to the host `dispatchEffect`, passing the firing scope's values
 * and a resolver for literal / expression action values.
 */
async function runEffectActions(args: {
  actions: EffectAction[];
  evaluators: Required<LinkageEvaluators>;
  evaluationContext: EvaluationContext | undefined;
  form: RuntimeForm;
  prefix: string;
  sinks: EffectSinks;
}): Promise<void> {
  const scopeValues = resolveScopeValues(args.form.store.state.values, args.prefix);
  const context: EffectDispatchContext = {
    values: scopeValues,
    resolveValue: value => resolveActionValue(value, scopeValues, args.evaluators, args.evaluationContext)
  };
  // Host-delegated effects may be async; collect their promises so a caller that
  // awaits the run (the `beforeSubmit` / `afterSubmit` lifecycle) actually waits.
  const pending: Array<Promise<void>> = [];

  for (const action of args.actions) {
    runEffectAction(action, args, context, pending);
  }

  await Promise.all(pending);
}

function runEffectAction(
  action: EffectAction,
  args: {
    evaluators: Required<LinkageEvaluators>;
    form: RuntimeForm;
    prefix: string;
    sinks: EffectSinks;
  },
  context: EffectDispatchContext,
  pending: Array<Promise<void>>
): void {
  switch (action.type) {
    case "set_field": {
      const name = `${args.prefix}${action.targetKey}`;
      const next = context.resolveValue(action.value);

      // A write of the value the target already holds is dropped: TanStack's
      // `setBy` mints a new values object even for an identical leaf, which
      // would read as a value change and re-fire an opaque-condition `always`
      // rule forever. Mirrors `setVariable`'s no-op bail (deep-equal because
      // an expression-resolved value may be a fresh but equal object).
      if (!isDeepEqual(args.form.getFieldValue(name), next)) {
        // Same options as `applyScopedAssignments`: a programmatic write must
        // not run the target's onChange listeners or mark it touched, so an
        // effect (e.g. a `load` write) never surfaces a premature validation
        // error.
        args.form.setFieldValue(name, next, {
          dontRunListeners: true,
          dontUpdateMeta: true
        });
      }

      return;
    }

    case "set_variable": {
      // Writes the form-global `$vars` store; the host owns the actual state,
      // so re-evaluation flows from its update (see `FormRenderer`).
      args.sinks.setVariable(action.variable, context.resolveValue(action.value));
      return;
    }

    case "refresh_data_source": {
      // Bumps the data-source version nonce; fields referencing the source
      // re-fetch through the resolver (see `useFieldOptions`). Scope-agnostic —
      // data sources are form-global regardless of which row fired the effect.
      args.sinks.refreshDataSource(action.dataSourceId);
      return;
    }

    case "submit": {
      // form-core's `handleSubmit` rethrows a rejecting host `onSubmit`. An
      // effect-triggered submit is fire-and-forget, so the rejection is
      // contained here (mirroring `runEffects`) instead of surfacing as an
      // unhandled promise rejection.
      args.form.handleSubmit().catch((error: unknown) => {
        console.error("[form-editor] submit effect failed:", error);
      });
      return;
    }

    case "reset": {
      args.form.reset();
      return;
    }

    case "alert": {
      pending.push(Promise.resolve(args.evaluators.dispatchEffect(action, context)));
      return;
    }

    case "api_call": {
      pending.push(Promise.resolve(args.evaluators.dispatchEffect(action, context)));
      return;
    }

    case "navigate": {
      pending.push(Promise.resolve(args.evaluators.dispatchEffect(action, context)));
      return;
    }

    default: {
      // Unknown action types in an externally-supplied schema are ignored on
      // the render path; the never-check keeps the switch exhaustive.
      exhaustive(action);
    }
  }
}

/**
 * Run form-scope effect actions (the global `load` / `beforeSubmit` /
 * `afterSubmit` lifecycle) against the root value scope. Used by `FormRenderer`,
 * which owns the form directly and has no surrounding scope provider. Returns a
 * promise so `beforeSubmit` can complete (including async host effects) before
 * the submission proceeds.
 */
export function dispatchFormEffects(args: {
  actions: EffectAction[];
  evaluators: LinkageEvaluators | undefined;
  evaluationContext: EvaluationContext | undefined;
  form: RuntimeForm;
  sinks: EffectSinks;
}): Promise<void> {
  if (args.actions.length === 0) {
    return Promise.resolve();
  }

  return runEffectActions({
    actions: args.actions,
    evaluators: resolveLinkageEvaluators(args.evaluators),
    evaluationContext: args.evaluationContext,
    form: args.form,
    prefix: "",
    sinks: args.sinks
  });
}

/**
 * The source values a rule's `always`-retrigger effects depend on, captured as a
 * positional tuple so the tracker can tell a real source-field change from an
 * unrelated one (the effect re-runs on every value change, but the `always`
 * effects must only repeat when *their* input moved). Compared with
 * {@link isDeepEqual}, so it captures the raw values directly — a `JSON.stringify`
 * fingerprint conflated `undefined` with `null`/absence and threw on `BigInt` or
 * cyclic values. `null` means "no tracked keys" — an opaque `expression`
 * condition, which re-fires on any actual *value* change while it holds (the
 * detector diffs the `values` reference for those — see {@link useScopeEffects}).
 * Reads keys the same way `matchLeaf` does (flat `values[key]`), so the tuple
 * tracks exactly what the condition evaluates.
 */
function inputSignature(sourceKeys: string[], values: RuntimeFormValues): unknown[] | null {
  if (sourceKeys.length === 0) {
    return null;
  }

  return sourceKeys.map(key => values[key]);
}

/**
 * Per-scope side-effect runtime. Returns the {@link RunEffects} dispatcher (used
 * by both event-triggered fields and the condition-edge detector) and, in an
 * effect, fires each condition-effect rule's actions on the false→true rising
 * edge, then repeats any per-action `"always"` ({@link ConditionRetrigger})
 * effects while the condition keeps holding and one of its source fields changes.
 *
 * Mirrors `LinkageScope`'s scoping — root or one subform row — so each row
 * tracks its own edges and dispatches against its own record. Edge detection
 * runs in an effect (never in render) so the render path stays pure, matching
 * `LinkageScope`'s assignment effect.
 */
export function useScopeEffects(args: {
  evaluators: LinkageEvaluators | undefined;
  evaluationContext: EvaluationContext | undefined;
  form: RuntimeForm;
  prefix: string;
  schema: RuntimeSchema;
  sinks: EffectSinks;
  values: RuntimeFormValues;
}): RunEffects {
  const {
    evaluators,
    evaluationContext,
    form,
    prefix,
    schema,
    sinks,
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

  // Read the evaluation context through a ref so the dispatcher identity
  // survives `$vars` writes. `runEffects` is the value of the context every
  // FieldSlot consumes — if it changed with the evaluation context, one
  // `set_variable` would re-render every leaf field straight through the
  // memo wall (the exact churn the renderer's `evaluationContextRef`
  // exists to prevent). Dispatch happens from events/effects, after render,
  // so the ref is always current by the time it is read.
  const evaluationContextRef = useRef(evaluationContext);
  evaluationContextRef.current = evaluationContext;

  const runEffects = useCallback<RunEffects>(
    actions => {
      if (actions.length > 0) {
        // Events / edges are fire-and-forget: a value-change cannot block. A
        // rejected host effect (e.g. an api_call) is contained here so it does
        // not surface as an unhandled promise rejection.
        runEffectActions({
          actions,
          evaluators: resolved,
          evaluationContext: evaluationContextRef.current,
          form,
          prefix,
          sinks
        }).catch((error: unknown) => {
          console.error("[form-editor] effect action failed:", error);
        });
      }
    },
    [resolved, form, prefix, sinks]
  );

  useEffect(() => {
    if (conditionRules.length === 0) {
      return;
    }

    const truths = evaluateConditionEffectTruths(conditionRules, values, resolved, evaluationContext);
    const signatures = conditionRules.map(rule => rule.alwaysActions.length > 0 ? inputSignature(rule.sourceKeys, values) : null);
    const previousTruths = truthsRef.current;
    const previousSignatures = signaturesRef.current;
    const previousValues = previousValuesRef.current;
    truthsRef.current = truths;
    signaturesRef.current = signatures;
    previousValuesRef.current = values;

    // Seed on the first run so a condition already true on mount does not fire;
    // only a later change triggers the effect thereafter.
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
        // Rising edge (false→true): every effect fires once, in declaration order.
        runEffects(rule.actions);
      } else if (rule.alwaysActions.length > 0) {
        // Still holding past the rising edge: repeat the `always` effects when a
        // tracked source field changed since the last evaluation. A `null`
        // signature (opaque expression condition) has no tracked keys, so it
        // re-fires on any actual value change — the `values` reference moving —
        // but NOT on a re-run driven by other deps (a `set_variable` updating
        // the evaluation context must not re-fire the very rule that wrote it).
        const changed = signatures[index] === null
          ? values !== previousValues
          : !isDeepEqual(signatures[index], previousSignatures?.[index]);

        if (changed) {
          runEffects(rule.alwaysActions);
        }
      }
    }
  }, [values, conditionRules, resolved, evaluationContext, runEffects]);

  return runEffects;
}
