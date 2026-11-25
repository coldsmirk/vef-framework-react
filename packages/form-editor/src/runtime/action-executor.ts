import type { WritableTargetField } from "../engine/linkage";
import type {
  EffectAction,
  EvaluationContext,
  FieldOption,
  FieldPermission,
  FormServices,
  KeyedFormField,
  LinkageAlertLevel,
  LinkageCondition,
  LinkageEvaluators,
  ResolvedDataSourceRequest,
  RuntimeSchema
} from "../types";
import type { PickRecord } from "./record-selector";
import type { SequenceController, SequenceRunHandle } from "./sequence-controller";
import type { RuntimeForm } from "./types";

import { showErrorMessage, showInfoMessage, showSuccessMessage, showWarningMessage } from "@vef-framework-react/components";
import { isDeepEqual } from "@vef-framework-react/shared";

import { exhaustive } from "../engine/assert-never";
import { resolveRequestParams } from "../engine/data-source-params";
import { isWritableTargetField, matchCondition, resolveActionValue } from "../engine/linkage";
import { isRootScope, walkNodes } from "../engine/schema/walk";
import { isRecord } from "../engine/validation";
import { writeFieldValue } from "./field-write";
import { inferSelectRecordColumns, normalizeRecordList } from "./record-selector";
import { resolveScopeValues } from "./resolve-scope-values";
import { busyKeyFor } from "./sequence-controller";

/**
 * Write a form-global variable (`$vars`).
 */
export type SetVariable = (name: string, value: unknown) => void;

/**
 * Re-resolve a form-global data source by id.
 */
export type RefreshDataSource = (dataSourceId: string) => void;

/**
 * Submit the form through the unified submit gate. When a submission is
 * already in progress (e.g. a `submit` action inside `beforeSubmit` /
 * `afterSubmit` or concurrent with another waiting submit), this resolves
 * immediately without deadlocking or starting a recursive submission.
 */
export type SubmitForm = () => Promise<void>;

/**
 * Reset the form through the unified reset gate. External resets pass no
 * `keepRunId` and abort every in-flight run; a sequence's own `reset` step
 * passes its `runId` so other runs abort while the calling sequence continues
 * executing its subsequent steps (e.g. "reset then write defaults").
 */
export type ResetForm = (keepRunId?: number) => void;

/**
 * Renderer-owned imperative sinks shared by every scope's effect executor.
 */
export interface EffectSinks {
  setVariable: SetVariable;
  refreshDataSource: RefreshDataSource;
  submitForm: SubmitForm;
  resetForm: ResetForm;
  pickRecord: PickRecord;
}

/**
 * Terminal outcome of executing one rule's action sequence:
 * - `"completed"`: every step ran to completion (including a false `when`
 * guard, empty actions, or finishing after `onError: "continue"` /
 * `whenNone: "continue"`). Only `"completed"` allows `beforeSubmit` to pass.
 * - `"stopped"`: terminated early without error (staleness discard,
 * `select_record` `whenNone: "stop"` on 0/dismissed records, or a disabled
 * form hitting `select_record` / `submit` / `reset`).
 * - `"aborted"`: cancelled by supersede, reset, unmount, or row deletion.
 * - `"failed"`: a step failed under `onError: "stop"` (the default).
 */
export type SequenceOutcome = "completed" | "stopped" | "aborted" | "failed";

/**
 * Stable, live-reading runtime environment shared by root scope, subform row
 * scopes, and form lifecycle hooks (`load` / `beforeSubmit` / `afterSubmit`).
 *
 * The object identity stays constant for the lifetime of the form instance so
 * memoized field cells never re-render when volatile props (`services`,
 * `$vars`, `disabled`, `fieldPermissions`) change, while every getter reads
 * the live value at step execution time.
 */
export interface SequenceEnv {
  readonly controller: SequenceController;
  readonly form: RuntimeForm;
  readonly sinks: EffectSinks;
  getDisabled: () => boolean;
  getEvaluationContext: () => EvaluationContext | undefined;
  getEvaluators: () => Required<LinkageEvaluators>;
  getFieldPermissions: () => Record<string, FieldPermission> | undefined;
  getKnownOptions: KnownOptionsLookup;
  getServices: () => FormServices | undefined;
}

const FORM_RULE_OWNER = "__form__";

const NOTIFY_BY_LEVEL: Record<LinkageAlertLevel, (text: string) => void> = {
  info: showInfoMessage,
  success: showSuccessMessage,
  warning: showWarningMessage,
  error: showErrorMessage
};

/**
 * Framework-default message sink used when `FormServices.notify` is omitted,
 * so `alert` actions and `select_record.emptyMessage` work out of the box.
 */
export function defaultNotify(level: LinkageAlertLevel, text: string): void {
  NOTIFY_BY_LEVEL[level](text);
}

function isAlertLevel(value: unknown): value is LinkageAlertLevel {
  return value === "info" || value === "success" || value === "warning" || value === "error";
}

export type KnownOptionsLookup = (
  field: KeyedFormField,
  scopeValues: Record<string, unknown>,
  evaluationContext: EvaluationContext | undefined,
  evaluators: Required<LinkageEvaluators>
) => readonly FieldOption[] | undefined;

export interface ExecuteActionSequenceArgs {
  actions: readonly EffectAction[];
  env: SequenceEnv;
  /**
   * Live field-name prefix for the firing scope (`""` at root, `"lines[i]."`
   * inside a subform row). Read fresh on every step so surviving rows whose
   * index shifted after an earlier row deletion still read and write their own
   * record.
   */
  getPrefix: () => string;
  /**
   * Field id that owns the triggering rule, used both to namespace the
   * single-flight slot and to drive the busy indicator while an `api_call`
   * step is in flight. Omitted for form-scoped rules.
   */
  ownerFieldId?: string;
  ruleId: string;
  schema: RuntimeSchema;
  scopeId: string;
  when?: LinkageCondition;
}

const ABORTED_SENTINEL = Symbol("sequence_aborted");

function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    // Attach a no-op handler so a host promise that rejects after abort never
    // turns into an unhandled rejection.
    promise.catch(() => undefined);
    return Promise.reject(ABORTED_SENTINEL);
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(ABORTED_SENTINEL);
    };

    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      value => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

function collectWritableFields(schema: RuntimeSchema): Map<string, WritableTargetField> {
  const writableFields = new Map<string, WritableTargetField>();

  walkNodes(schema, (node, scope) => {
    if (isRootScope(scope) && isWritableTargetField(node)) {
      writableFields.set(node.key, node);
    }
  });

  return writableFields;
}

/**
 * Execute one rule's ordered effect action sequence.
 *
 * Purely synchronous sequences (`set_fields`, `set_variable`,
 * `refresh_data_source`, `alert`, `navigate`, `reset`, 0- or 1-record
 * `select_record`) complete synchronously and return a {@link SequenceOutcome}
 * without allocating a Promise. Only genuinely asynchronous steps (`api_call`,
 * multi-record `select_record`, `submit`) transition to a Promise chain.
 *
 * Never throws and never rejects. A host function (evaluator, `notify`, sink)
 * that throws outside a step's own `onError` handling is logged and settles the
 * sequence as `"failed"`, so no trigger site — an event handler, an edge
 * detection effect, a form lifecycle hook — has to contain it.
 */
export function executeActionSequence(args: ExecuteActionSequenceArgs): SequenceOutcome | Promise<SequenceOutcome> {
  try {
    const result = runActionSequence(args);

    return result instanceof Promise ? result.catch(failUnexpectedly) : result;
  } catch (error) {
    return failUnexpectedly(error);
  }
}

function failUnexpectedly(error: unknown): SequenceOutcome {
  console.error("[form-editor] effect sequence threw unexpectedly:", error);

  return "failed";
}

/**
 * Settlement is exception-safe: every exit path (completion, early stop,
 * abort, step failure, or unexpected host throw) passes through the single
 * `run.finish()` settlement point so slots, busy counters, and the submit gate
 * can never leak.
 */
function runActionSequence(args: ExecuteActionSequenceArgs): SequenceOutcome | Promise<SequenceOutcome> {
  const {
    actions,
    env,
    getPrefix,
    ownerFieldId,
    ruleId,
    schema,
    scopeId,
    when
  } = args;

  if (!Array.isArray(actions) || actions.length === 0) {
    return "completed";
  }

  // Evaluate trigger guard at fire time against the scope's live values (no
  // `$steps` in guard context). A false guard leaves the rule silent.
  if (when !== undefined) {
    const guardValues = resolveScopeValues(env.form.store.state.values, getPrefix());

    if (!matchCondition(when, guardValues, env.getEvaluators(), env.getEvaluationContext())) {
      return "completed";
    }
  }

  const ownerKey = ownerFieldId ?? FORM_RULE_OWNER;
  const run: SequenceRunHandle = env.controller.startRun(scopeId, ownerKey, ruleId);
  let handedOff = false;

  try {
    const writableFields = collectWritableFields(schema);
    const steps: Record<string, unknown> = {};
    const variableOverlay = new Map<string, { written: unknown; baseAtWrite: unknown }>();

    const readScopeValues = (): Record<string, unknown> => resolveScopeValues(env.form.store.state.values, getPrefix());

    const buildStepContext = (): EvaluationContext => {
      const base = env.getEvaluationContext();
      let variables = base?.variables;

      if (variableOverlay.size > 0) {
        let merged: Record<string, unknown> | undefined;

        for (const [name, entry] of variableOverlay) {
          if (!isDeepEqual(base?.variables?.[name], entry.baseAtWrite)) {
            continue;
          }

          merged ??= { ...base?.variables };
          merged[name] = entry.written;
        }

        if (merged !== undefined) {
          variables = merged;
        }
      }

      return {
        ...base,
        variables,
        steps
      };
    };

    const resolveRequest = (request: Extract<EffectAction, { type: "api_call" }>["request"]): ResolvedDataSourceRequest => {
      const scopeValues = readScopeValues();
      const stepContext = buildStepContext();
      const evaluators = env.getEvaluators();

      return resolveRequestParams(
        request,
        param => resolveActionValue(param, scopeValues, evaluators, stepContext, { allowSteps: true })
      );
    };

    const notifyNow = (level: LinkageAlertLevel, text: string): void => {
      (env.getServices()?.notify ?? defaultNotify)(level, text);
    };

    const handleStepError = (action: EffectAction): boolean => {
      if (action.onError === "continue") {
        if ("output" in action && typeof action.output === "string" && action.output.length > 0) {
          steps[action.output] = undefined;
        }

        return true;
      }

      return false;
    };

    const applyFieldAssignments = (assignments: readonly unknown[]): void => {
      const scopeValues = readScopeValues();
      const stepContext = buildStepContext();
      const evaluators = env.getEvaluators();
      const fieldPermissions = env.getFieldPermissions();
      const prefix = getPrefix();
      const disabled = env.getDisabled();

      for (const rawAssignment of assignments) {
        if (!isRecord(rawAssignment) || typeof rawAssignment.targetKey !== "string" || rawAssignment.targetKey.length === 0) {
          continue;
        }

        const { targetKey } = rawAssignment;
        const targetField = writableFields.get(targetKey);

        // Single writable-target boundary: undeclared keys, containers, and
        // non-writable fields (`upload`) are absent from `writableFields` and
        // skipped directly.
        if (targetField === undefined) {
          continue;
        }

        const resolved = resolveActionValue(
          rawAssignment.value as Extract<EffectAction, { type: "set_fields" }>["assignments"][number]["value"],
          scopeValues,
          evaluators,
          stepContext,
          { allowSteps: true }
        );
        const knownOptions = env.getKnownOptions(targetField, scopeValues, stepContext, evaluators);

        writeFieldValue({
          disabled,
          fieldPermissions,
          form: env.form,
          key: targetKey,
          knownOptions,
          prefix,
          targetField,
          value: resolved
        });
      }
    };

    const executeStep = (index: number, action: EffectAction): "next" | SequenceOutcome | Promise<SequenceOutcome> => {
      switch (action.type) {
        case "set_fields": {
          // Rule 6: disabled forms never mutate values, while non-mutating
          // steps later in the sequence may still run.
          if (env.getDisabled() || !Array.isArray(action.assignments)) {
            return "next";
          }

          try {
            applyFieldAssignments(action.assignments);
          } catch {
            if (!handleStepError(action)) {
              return "failed";
            }
          }

          return "next";
        }

        case "set_variable": {
          if (typeof action.variable !== "string" || action.variable.length === 0) {
            return "next";
          }

          try {
            const value = resolveActionValue(
              action.value,
              readScopeValues(),
              env.getEvaluators(),
              buildStepContext(),
              { allowSteps: true }
            );
            const baseBefore = env.getEvaluationContext()?.variables?.[action.variable];

            env.sinks.setVariable(action.variable, value);

            const baseAfter = env.getEvaluationContext()?.variables?.[action.variable];

            // Keep a local overlay only when `sinks.setVariable` did not
            // already reflect synchronously into `getEvaluationContext` (e.g.
            // an isolated unit-test mock); yield automatically if another rule
            // changes the live variable while this sequence awaits.
            if (isDeepEqual(baseAfter, value)) {
              variableOverlay.delete(action.variable);
            } else {
              variableOverlay.set(action.variable, { written: value, baseAtWrite: baseBefore });
            }
          } catch {
            if (!handleStepError(action)) {
              return "failed";
            }
          }

          return "next";
        }

        case "refresh_data_source": {
          if (typeof action.dataSourceId === "string" && action.dataSourceId.length > 0) {
            env.sinks.refreshDataSource(action.dataSourceId);
          }

          return "next";
        }

        case "alert": {
          try {
            const text = String(resolveActionValue(
              action.message,
              readScopeValues(),
              env.getEvaluators(),
              buildStepContext(),
              { allowSteps: true }
            ) ?? "");
            const level: LinkageAlertLevel = isAlertLevel(action.level) ? action.level : "info";

            notifyNow(level, text);
          } catch {
            if (!handleStepError(action)) {
              return "failed";
            }
          }

          return "next";
        }

        case "navigate": {
          try {
            const to = String(resolveActionValue(
              action.to,
              readScopeValues(),
              env.getEvaluators(),
              buildStepContext(),
              { allowSteps: true }
            ) ?? "");

            env.getServices()?.navigate?.(to);
          } catch {
            if (!handleStepError(action)) {
              return "failed";
            }
          }

          return "next";
        }

        case "reset": {
          // Rule 6: disabled form terminates sequence on reset.
          if (env.getDisabled()) {
            return "stopped";
          }

          // Abort every OTHER in-flight run and reset values, while allowing
          // THIS sequence to continue its remaining steps ("reset then write
          // defaults").
          env.sinks.resetForm(run.runId);

          return "next";
        }

        case "submit": {
          // Rule 6: disabled form terminates sequence on submit.
          if (env.getDisabled()) {
            return "stopped";
          }

          // Every request preceding this `submit` step has already completed
          // and written, so release our submit-gate hold now — concurrent
          // `api_call → submit` runs can never wait on each other.
          run.leaveSubmitGate();

          return (async (): Promise<SequenceOutcome> => {
            try {
              await env.sinks.submitForm();
            } catch {
              if (run.signal.aborted) {
                return "aborted";
              }

              if (!handleStepError(action)) {
                return "failed";
              }
            }

            if (run.signal.aborted) {
              return "aborted";
            }

            return executeFrom(index + 1);
          })();
        }

        case "api_call": {
          const rawRequest: unknown = action.request;

          if (!isRecord(rawRequest) || typeof rawRequest.resource !== "string" || typeof rawRequest.action !== "string") {
            return handleStepError(action) ? "next" : "failed";
          }

          const requestSpec = action.request;
          const requestFn = env.getServices()?.request;

          if (requestFn === undefined) {
            return handleStepError(action) ? "next" : "failed";
          }

          let sentRequest: ResolvedDataSourceRequest;

          try {
            sentRequest = resolveRequest(requestSpec);
          } catch {
            return handleStepError(action) ? "next" : "failed";
          }

          const busyKey = ownerFieldId === undefined ? undefined : busyKeyFor(scopeId, ownerFieldId);
          // Mark pending & busy SYNCHRONOUSLY before yielding to the request
          // promise so an immediate submit or render observes it right away.
          const endRequest = run.beginRequest(busyKey);

          return (async (): Promise<SequenceOutcome> => {
            let response: unknown;
            let failedAndContinue = false;

            try {
              try {
                const rawPromise: unknown = requestFn(sentRequest, { signal: run.signal });

                if (
                  rawPromise === null
                  || (typeof rawPromise !== "object" && typeof rawPromise !== "function")
                  || typeof (rawPromise as PromiseLike<unknown>).then !== "function"
                ) {
                  throw new TypeError("FormServices.request must return a Promise");
                }

                response = await raceWithAbort(Promise.resolve(rawPromise), run.signal);
              } finally {
                endRequest();
              }
            } catch (error) {
              // Abort is never an error — terminate quietly with `"aborted"`.
              if (error === ABORTED_SENTINEL || run.signal.aborted) {
                return "aborted";
              }

              if (!handleStepError(action)) {
                return "failed";
              }

              failedAndContinue = true;
            }

            if (run.signal.aborted) {
              return "aborted";
            }

            if (failedAndContinue) {
              return executeFrom(index + 1);
            }

            // Rule 2 (staleness): re-resolve the request against live scope
            // values; if inputs drifted while the request was in flight, drop
            // the stale response and stop the sequence without writing.
            const currentRequest = resolveRequest(requestSpec);

            if (!isDeepEqual(sentRequest, currentRequest)) {
              return "stopped";
            }

            if (typeof action.output === "string" && action.output.length > 0) {
              steps[action.output] = response;
            }

            return executeFrom(index + 1);
          })();
        }

        case "select_record": {
          // Rule 6: disabled form terminates sequence on select_record.
          if (env.getDisabled()) {
            return "stopped";
          }

          let rawSource: unknown;

          try {
            rawSource = resolveActionValue(
              action.source,
              readScopeValues(),
              env.getEvaluators(),
              buildStepContext(),
              { allowSteps: true }
            );
          } catch {
            return handleStepError(action) ? "next" : "failed";
          }

          const records = normalizeRecordList(rawSource);
          const output = typeof action.output === "string" && action.output.length > 0 ? action.output : undefined;
          const whenNone = action.whenNone === "continue" ? "continue" : "stop";

          if (records.length === 0) {
            if (typeof action.emptyMessage === "string" && action.emptyMessage.length > 0) {
              notifyNow("info", action.emptyMessage);
            }

            if (output !== undefined) {
              steps[output] = undefined;
            }

            return whenNone === "stop" ? "stopped" : "next";
          }

          if (records.length === 1) {
            if (output !== undefined) {
              steps[output] = records[0];
            }

            return "next";
          }

          const columns = inferSelectRecordColumns(action, actions.slice(index + 1), records, writableFields);

          return (async (): Promise<SequenceOutcome> => {
            let picked: Record<string, unknown> | undefined;
            let failedAndContinue = false;

            try {
              picked = await raceWithAbort(
                env.sinks.pickRecord({
                  records,
                  columns,
                  title: action.title,
                  signal: run.signal
                }),
                run.signal
              );
            } catch (error) {
              if (error === ABORTED_SENTINEL || run.signal.aborted) {
                return "aborted";
              }

              if (!handleStepError(action)) {
                return "failed";
              }

              failedAndContinue = true;
            }

            if (run.signal.aborted) {
              return "aborted";
            }

            if (failedAndContinue) {
              return executeFrom(index + 1);
            }

            if (output !== undefined) {
              steps[output] = picked;
            }

            if (picked === undefined && whenNone === "stop") {
              return "stopped";
            }

            return executeFrom(index + 1);
          })();
        }

        default: {
          // Unknown action types in an externally-supplied schema are skipped
          // safely while the exhaustive check keeps compile-time coverage.
          exhaustive(action);

          return "next";
        }
      }
    };

    function executeFrom(startIndex: number): SequenceOutcome | Promise<SequenceOutcome> {
      for (let index = startIndex; index < actions.length; index++) {
        if (run.signal.aborted) {
          return "aborted";
        }

        const rawAction: unknown = actions[index];

        if (!isRecord(rawAction) || typeof rawAction.type !== "string") {
          continue;
        }

        const outcome = executeStep(index, rawAction as EffectAction);

        if (outcome !== "next") {
          return outcome;
        }
      }

      return "completed";
    }

    const result = executeFrom(0);

    if (result instanceof Promise) {
      handedOff = true;

      return result.finally(() => {
        run.finish();
      });
    }

    return result;
  } finally {
    if (!handedOff) {
      run.finish();
    }
  }
}
