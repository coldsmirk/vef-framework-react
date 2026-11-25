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
import { isKeyedNode } from "../engine/keys";
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
 * Submit the form through the unified submit gate. A sequence's own `submit`
 * step passes its `excludeRunId` so the gate waits for other in-flight
 * requests without deadlocking on the sequence itself.
 */
export type SubmitForm = (options?: { excludeRunId?: number }) => Promise<void>;

/**
 * Reset the form through the unified reset gate (aborts all in-flight runs
 * before clearing values).
 */
export type ResetForm = () => void;

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
  controller: SequenceController;
  disabled: boolean;
  evaluators: Required<LinkageEvaluators>;
  form: RuntimeForm;
  getEvaluationContext: () => EvaluationContext | undefined;
  getFieldPermissions: () => Record<string, FieldPermission> | undefined;
  getKnownOptions: KnownOptionsLookup;
  /**
   * Live field-name prefix for the firing scope (`""` at root, `"lines[i]."`
   * inside a subform row). Read fresh on every step so surviving rows whose
   * index shifted after an earlier row deletion still read and write their own
   * record.
   */
  getPrefix: () => string;
  /**
   * Field id that owns the triggering rule, used to drive the busy indicator
   * while an `api_call` step is in flight.
   */
  ownerFieldId?: string;
  /**
   * Propagate step errors instead of containing them (true for `beforeSubmit`
   * so a failed precondition blocks submission).
   */
  propagateErrors?: boolean;
  ruleId: string;
  schema: RuntimeSchema;
  scopeId: string;
  services: FormServices | undefined;
  sinks: EffectSinks;
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

interface ScopeTargetIndex {
  writableFields: Map<string, KeyedFormField>;
  blockedKeys: Set<string>;
}

function collectScopeTargets(schema: RuntimeSchema): ScopeTargetIndex {
  const writableFields = new Map<string, KeyedFormField>();
  const blockedKeys = new Set<string>();

  walkNodes(schema, (node, scope) => {
    if (!isRootScope(scope) || !isKeyedNode(node)) {
      return;
    }

    if (node.type === "subform" || node.type === "upload") {
      blockedKeys.add(node.key);
      return;
    }

    if (isWritableTargetField(node)) {
      writableFields.set(node.key, node);
    }
  });

  return { writableFields, blockedKeys };
}

/**
 * Execute one rule's ordered effect action sequence.
 *
 * Purely synchronous sequences (`set_fields`, `set_variable`,
 * `refresh_data_source`, `alert`, `navigate`, `reset`, 0- or 1-record
 * `select_record`) complete synchronously and return `undefined` without
 * allocating a Promise. Only genuinely asynchronous steps (`api_call`,
 * multi-record `select_record`, `submit`) transition to a Promise chain.
 */
export function executeActionSequence(args: ExecuteActionSequenceArgs): void | Promise<void> {
  const {
    actions,
    controller,
    disabled,
    evaluators,
    form,
    getEvaluationContext,
    getFieldPermissions,
    getKnownOptions,
    getPrefix,
    ownerFieldId,
    propagateErrors = false,
    ruleId,
    schema,
    scopeId,
    services,
    sinks,
    when
  } = args;

  if (!Array.isArray(actions) || actions.length === 0) {
    return;
  }

  // Evaluate trigger guard at fire time against the scope's live values (no
  // `$steps` in guard context). A false guard leaves the rule silent.
  if (when !== undefined) {
    const guardValues = resolveScopeValues(form.store.state.values, getPrefix());

    if (!matchCondition(when, guardValues, evaluators, getEvaluationContext())) {
      return;
    }
  }

  const run: SequenceRunHandle = controller.startRun(scopeId, ruleId);
  const { blockedKeys, writableFields } = collectScopeTargets(schema);
  const steps: Record<string, unknown> = {};
  const variableOverlay = new Map<string, unknown>();
  const notify = services?.notify ?? defaultNotify;

  const readScopeValues = (): Record<string, unknown> => resolveScopeValues(form.store.state.values, getPrefix());

  const buildStepContext = (): EvaluationContext => {
    const base = getEvaluationContext();
    const variables = variableOverlay.size > 0
      ? { ...base?.variables, ...Object.fromEntries(variableOverlay) }
      : base?.variables;

    return {
      ...base,
      variables,
      steps
    };
  };

  const resolveRequest = (request: Extract<EffectAction, { type: "api_call" }>["request"]): ResolvedDataSourceRequest => {
    const scopeValues = readScopeValues();
    const stepContext = buildStepContext();

    return resolveRequestParams(
      request,
      param => resolveActionValue(param, scopeValues, evaluators, stepContext, { allowSteps: true })
    );
  };

  const handleStepError = (action: EffectAction, error: unknown): boolean => {
    if (action.onError === "continue") {
      if ("output" in action && typeof action.output === "string" && action.output.length > 0) {
        steps[action.output] = undefined;
      }

      return true;
    }

    run.finish();

    if (propagateErrors) {
      throw error;
    }

    return false;
  };

  const applyFieldAssignments = (assignments: readonly unknown[]): void => {
    const scopeValues = readScopeValues();
    const stepContext = buildStepContext();
    const fieldPermissions = getFieldPermissions();
    const prefix = getPrefix();

    for (const rawAssignment of assignments) {
      if (!isRecord(rawAssignment) || typeof rawAssignment.targetKey !== "string" || rawAssignment.targetKey.length === 0) {
        continue;
      }

      const { targetKey } = rawAssignment;

      if (blockedKeys.has(targetKey)) {
        continue;
      }

      const targetField = writableFields.get(targetKey);
      const resolved = resolveActionValue(
        rawAssignment.value as Extract<EffectAction, { type: "set_fields" }>["assignments"][number]["value"],
        scopeValues,
        evaluators,
        stepContext,
        { allowSteps: true }
      );
      const knownOptions = targetField === undefined
        ? undefined
        : getKnownOptions(targetField, scopeValues, stepContext, evaluators);

      writeFieldValue({
        disabled,
        fieldPermissions,
        form,
        key: targetKey,
        knownOptions,
        prefix,
        targetField,
        value: resolved
      });
    }
  };

  const executeStep = (index: number, action: EffectAction): "next" | "stop" | Promise<void> => {
    switch (action.type) {
      case "set_fields": {
        // Rule 6: disabled forms never mutate values, while non-mutating
        // steps later in the sequence may still run.
        if (disabled || !Array.isArray(action.assignments)) {
          return "next";
        }

        try {
          applyFieldAssignments(action.assignments);
        } catch (error) {
          if (!handleStepError(action, error)) {
            return "stop";
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
            evaluators,
            buildStepContext(),
            { allowSteps: true }
          );

          variableOverlay.set(action.variable, value);
          sinks.setVariable(action.variable, value);
        } catch (error) {
          if (!handleStepError(action, error)) {
            return "stop";
          }
        }

        return "next";
      }

      case "refresh_data_source": {
        if (typeof action.dataSourceId === "string" && action.dataSourceId.length > 0) {
          sinks.refreshDataSource(action.dataSourceId);
        }

        return "next";
      }

      case "alert": {
        try {
          const text = String(resolveActionValue(
            action.message,
            readScopeValues(),
            evaluators,
            buildStepContext(),
            { allowSteps: true }
          ) ?? "");
          const level: LinkageAlertLevel = isAlertLevel(action.level) ? action.level : "info";

          notify(level, text);
        } catch (error) {
          if (!handleStepError(action, error)) {
            return "stop";
          }
        }

        return "next";
      }

      case "navigate": {
        try {
          const to = String(resolveActionValue(
            action.to,
            readScopeValues(),
            evaluators,
            buildStepContext(),
            { allowSteps: true }
          ) ?? "");

          services?.navigate?.(to);
        } catch (error) {
          if (!handleStepError(action, error)) {
            return "stop";
          }
        }

        return "next";
      }

      case "reset": {
        // Rule 6: disabled form terminates sequence on reset.
        if (disabled) {
          run.finish();
          return "stop";
        }

        sinks.resetForm();
        run.finish();
        return "stop";
      }

      case "submit": {
        // Rule 6: disabled form terminates sequence on submit.
        if (disabled) {
          run.finish();
          return "stop";
        }

        return (async () => {
          try {
            await sinks.submitForm({ excludeRunId: run.runId });
          } catch (error) {
            if (run.signal.aborted) {
              run.finish();
              return;
            }

            if (!handleStepError(action, error)) {
              return;
            }
          }

          await executeFrom(index + 1);
        })();
      }

      case "api_call": {
        const rawRequest: unknown = action.request;

        if (!isRecord(rawRequest) || typeof rawRequest.resource !== "string" || typeof rawRequest.action !== "string") {
          return handleStepError(action, new Error("Malformed api_call request")) ? "next" : "stop";
        }

        const requestSpec = action.request;
        const requestFn = services?.request;

        if (requestFn === undefined) {
          return handleStepError(action, new Error("FormServices.request is not configured")) ? "next" : "stop";
        }

        let sentRequest: ResolvedDataSourceRequest;

        try {
          sentRequest = resolveRequest(requestSpec);
        } catch (error) {
          return handleStepError(action, error) ? "next" : "stop";
        }

        const busyKey = ownerFieldId === undefined ? undefined : busyKeyFor(scopeId, ownerFieldId);
        // Mark pending & busy SYNCHRONOUSLY before yielding to the request
        // promise so an immediate submit or render observes it right away.
        const endRequest = run.beginRequest(busyKey);

        return (async () => {
          let response: unknown;

          try {
            response = await raceWithAbort(requestFn(sentRequest, { signal: run.signal }), run.signal);
          } catch (error) {
            endRequest();

            // Abort is never an error — terminate quietly without rethrow.
            if (error === ABORTED_SENTINEL || run.signal.aborted) {
              run.finish();
              return;
            }

            if (!handleStepError(action, error)) {
              return;
            }

            await executeFrom(index + 1);
            return;
          }

          endRequest();

          if (run.signal.aborted) {
            run.finish();
            return;
          }

          // Rule 2 (staleness): re-resolve the request against live scope
          // values; if inputs drifted while the request was in flight, drop
          // the stale response and stop the sequence without writing.
          const currentRequest = resolveRequest(requestSpec);

          if (!isDeepEqual(sentRequest, currentRequest)) {
            run.finish();
            return;
          }

          if (typeof action.output === "string" && action.output.length > 0) {
            steps[action.output] = response;
          }

          await executeFrom(index + 1);
        })();
      }

      case "select_record": {
        // Rule 6: disabled form terminates sequence on select_record.
        if (disabled) {
          run.finish();
          return "stop";
        }

        let rawSource: unknown;

        try {
          rawSource = resolveActionValue(
            action.source,
            readScopeValues(),
            evaluators,
            buildStepContext(),
            { allowSteps: true }
          );
        } catch (error) {
          return handleStepError(action, error) ? "next" : "stop";
        }

        const records = normalizeRecordList(rawSource);
        const output = typeof action.output === "string" && action.output.length > 0 ? action.output : undefined;
        const whenNone = action.whenNone === "continue" ? "continue" : "stop";

        if (records.length === 0) {
          if (typeof action.emptyMessage === "string" && action.emptyMessage.length > 0) {
            notify("info", action.emptyMessage);
          }

          if (output !== undefined) {
            steps[output] = undefined;
          }

          if (whenNone === "stop") {
            run.finish();
            return "stop";
          }

          return "next";
        }

        if (records.length === 1) {
          if (output !== undefined) {
            steps[output] = records[0];
          }

          return "next";
        }

        const columns = inferSelectRecordColumns(action, actions.slice(index + 1), records, writableFields);

        return (async () => {
          let picked: Record<string, unknown> | undefined;

          try {
            picked = await raceWithAbort(
              sinks.pickRecord({
                records,
                columns,
                title: action.title,
                signal: run.signal
              }),
              run.signal
            );
          } catch (error) {
            if (error === ABORTED_SENTINEL || run.signal.aborted) {
              run.finish();
              return;
            }

            if (!handleStepError(action, error)) {
              return;
            }

            await executeFrom(index + 1);
            return;
          }

          if (run.signal.aborted) {
            run.finish();
            return;
          }

          if (output !== undefined) {
            steps[output] = picked;
          }

          if (picked === undefined && whenNone === "stop") {
            run.finish();
            return;
          }

          await executeFrom(index + 1);
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

  function executeFrom(startIndex: number): void | Promise<void> {
    for (let index = startIndex; index < actions.length; index++) {
      if (run.signal.aborted) {
        run.finish();
        return;
      }

      const rawAction: unknown = actions[index];

      if (!isRecord(rawAction) || typeof rawAction.type !== "string") {
        continue;
      }

      const outcome = executeStep(index, rawAction as EffectAction);

      if (outcome === "stop") {
        return;
      }

      if (outcome !== "next") {
        return outcome;
      }
    }

    run.finish();
  }

  return executeFrom(0);
}
