import type {
  DynamicValue,
  FieldAssignment,
  FieldLinkageAction,
  LinkageActionType,
  RemoteDataSourceRequest
} from "../../types";

import { omit } from "@vef-framework-react/shared";

import { mapPreservingIdentity } from "../schema/nodes";
import { isRecord } from "../validation";

/**
 * Single declarative registry of every linkage action's structural slots.
 *
 * Validation, key rename, reference prune, variable rename, data-source prune,
 * date-literal detection/scrubbing, clone/move key remapping, and bound-param
 * scanning all traverse actions exclusively through this registry. Adding a new
 * action type forces one complete entry in {@link ACTION_DESCRIPTORS}
 * (compile-checked via `Record<LinkageActionType, …>`) plus one execution
 * branch, with no scattered `switch (action.type)` passes to keep in sync.
 */

/**
 * The form field a dynamic value is written to: the rule's own field
 * (`assign`), or a same-scope field by key (`set_fields`).
 */
export type WriteTarget = { kind: "self" } | { kind: "field"; key: string };

export interface DynamicValueSlot {
  /**
   * Relative path inside the action (e.g. `"value"`, `"assignments[0].value"`,
   * `"request.params.empNo"`, `"source"`, `"message"`, `"to"`).
   */
  path: string;
  /**
   * Raw value at the slot (untyped so the validator can flag malformed shapes
   * on untrusted JSON without crashing).
   */
  value: unknown;
  /**
   * Whether `$steps.<output>` references are permitted in this slot (`false`
   * for state actions, `true` for effect actions).
   */
  allowSteps: boolean;
  /**
   * The field this slot writes; omitted when it does not write one.
   */
  target?: WriteTarget;
}

export interface TargetKeySlot {
  /**
   * Relative path inside the action (e.g. `"assignments[0].targetKey"`).
   */
  path: string;
  /**
   * Raw candidate target key (untyped for untrusted-JSON validation).
   */
  targetKey: unknown;
}

export interface RequestSlot {
  path: string;
  request: unknown;
}

export interface OutputSlot<TAction extends FieldLinkageAction = FieldLinkageAction> {
  path: string;
  required: boolean;
  read: (action: TAction) => unknown;
  /**
   * Rename the output; `undefined` clears it.
   */
  write: (action: TAction, next: string | undefined) => TAction;
}

export interface VariableSlot<TAction extends FieldLinkageAction = FieldLinkageAction> {
  path: string;
  read: (action: TAction) => unknown;
  write: (action: TAction, next: string) => TAction;
}

export interface DataSourceIdSlot<TAction extends FieldLinkageAction = FieldLinkageAction> {
  path: string;
  read: (action: TAction) => unknown;
}

export interface ActionDescriptor<TAction extends FieldLinkageAction = FieldLinkageAction> {
  family: "state" | "effect";
  dynamicValues?: (action: TAction) => DynamicValueSlot[];
  mapDynamicValues?: (
    action: TAction,
    mapper: (value: DynamicValue, target: WriteTarget | undefined) => DynamicValue
  ) => TAction;
  targetKeys?: (action: TAction) => TargetKeySlot[];
  mapTargetKeys?: (
    action: TAction,
    mapper: (targetKey: string) => string | undefined
  ) => TAction | undefined;
  output?: OutputSlot<TAction>;
  requests?: (action: TAction) => RequestSlot[];
  variable?: VariableSlot<TAction>;
  dataSourceId?: DataSourceIdSlot<TAction>;
}

type ActionByType<T extends LinkageActionType> = Extract<FieldLinkageAction, { type: T }>;

type ActionDescriptorTable = {
  [T in LinkageActionType]: ActionDescriptor<ActionByType<T>>;
};

const SELF_TARGET: WriteTarget = { kind: "self" };

const EMPTY_STATE_DESCRIPTOR: { readonly family: "state" } = {
  family: "state"
};

const EMPTY_EFFECT_DESCRIPTOR: { readonly family: "effect" } = {
  family: "effect"
};

/**
 * Rewrite every `DynamicValue` entry of `request.params`, preserving identity
 * when no param changed. Shared by `api_call` and option-source reconcilers.
 */
export function mapRemoteRequestDynamicValues(
  request: RemoteDataSourceRequest,
  mapper: (value: DynamicValue) => DynamicValue
): RemoteDataSourceRequest {
  if (!isRecord(request) || !isRecord(request.params)) {
    return request;
  }

  let changed = false;
  const nextParams: Record<string, DynamicValue> = {};

  for (const [paramKey, raw] of Object.entries(request.params)) {
    const param = raw as DynamicValue;
    const mapped = mapper(param);

    if (mapped !== param) {
      changed = true;
    }

    nextParams[paramKey] = mapped;
  }

  return changed ? { ...request, params: nextParams } : request;
}

function collectRequestParamSlots(request: unknown, basePath: string, allowSteps: boolean): DynamicValueSlot[] {
  if (!isRecord(request) || !isRecord(request.params)) {
    return [];
  }

  const slots: DynamicValueSlot[] = [];

  for (const [paramKey, value] of Object.entries(request.params)) {
    slots.push({
      path: `${basePath}.params.${paramKey}`,
      value,
      allowSteps
    });
  }

  return slots;
}

export const ACTION_DESCRIPTORS: ActionDescriptorTable = {
  show: EMPTY_STATE_DESCRIPTOR,
  hide: EMPTY_STATE_DESCRIPTOR,
  enable: EMPTY_STATE_DESCRIPTOR,
  disable: EMPTY_STATE_DESCRIPTOR,
  require: EMPTY_STATE_DESCRIPTOR,
  optional: EMPTY_STATE_DESCRIPTOR,
  script: {
    family: "state"
  },
  assign: {
    family: "state",
    dynamicValues: action => [
      {
        path: "value",
        value: action.value,
        allowSteps: false,
        target: SELF_TARGET
      }
    ],
    mapDynamicValues: (action, mapper) => {
      const next = mapper(action.value, SELF_TARGET);

      return next === action.value ? action : { ...action, value: next };
    }
  },
  set_fields: {
    family: "effect",
    dynamicValues: action => {
      if (!Array.isArray(action.assignments)) {
        return [];
      }

      const slots: DynamicValueSlot[] = [];

      for (const [index, entry] of action.assignments.entries()) {
        if (!isRecord(entry)) {
          continue;
        }

        slots.push({
          path: `assignments[${index}].value`,
          value: entry.value,
          allowSteps: true,
          ...typeof entry.targetKey === "string" && { target: { kind: "field", key: entry.targetKey } }
        });
      }

      return slots;
    },
    mapDynamicValues: (action, mapper) => {
      if (!Array.isArray(action.assignments)) {
        return action;
      }

      const assignments = mapPreservingIdentity(action.assignments, entry => {
        const nextValue = mapper(entry.value, { kind: "field", key: entry.targetKey });

        return nextValue === entry.value ? entry : { ...entry, value: nextValue };
      });

      return assignments === action.assignments ? action : { ...action, assignments };
    },
    targetKeys: action => {
      if (!Array.isArray(action.assignments)) {
        return [];
      }

      const slots: TargetKeySlot[] = [];

      for (const [index, entry] of action.assignments.entries()) {
        if (!isRecord(entry)) {
          continue;
        }

        slots.push({
          path: `assignments[${index}].targetKey`,
          targetKey: entry.targetKey
        });
      }

      return slots;
    },
    mapTargetKeys: (action, mapper) => {
      if (!Array.isArray(action.assignments)) {
        return action;
      }

      const nextAssignments: FieldAssignment[] = [];
      let changed = false;

      for (const entry of action.assignments) {
        const mapped = mapper(entry.targetKey);

        if (mapped === undefined) {
          changed = true;
          continue;
        }

        if (mapped === entry.targetKey) {
          nextAssignments.push(entry);
        } else {
          changed = true;
          nextAssignments.push({ ...entry, targetKey: mapped });
        }
      }

      if (!changed) {
        return action;
      }

      return nextAssignments.length === 0 ? undefined : { ...action, assignments: nextAssignments };
    }
  },
  set_variable: {
    family: "effect",
    dynamicValues: action => [
      {
        path: "value",
        value: action.value,
        allowSteps: true
      }
    ],
    mapDynamicValues: (action, mapper) => {
      const next = mapper(action.value, undefined);

      return next === action.value ? action : { ...action, value: next };
    },
    variable: {
      path: "variable",
      read: action => action.variable,
      write: (action, next) => action.variable === next ? action : { ...action, variable: next }
    }
  },
  api_call: {
    family: "effect",
    dynamicValues: action => collectRequestParamSlots(action.request, "request", true),
    mapDynamicValues: (action, mapper) => {
      const nextRequest = mapRemoteRequestDynamicValues(action.request, value => mapper(value, undefined));

      return nextRequest === action.request ? action : { ...action, request: nextRequest };
    },
    requests: action => [{ path: "request", request: action.request }],
    output: {
      path: "output",
      required: false,
      read: action => action.output,
      write: (action, next) => next === undefined ? omit(action, ["output"]) : { ...action, output: next }
    }
  },
  select_record: {
    family: "effect",
    dynamicValues: action => [
      {
        path: "source",
        value: action.source,
        allowSteps: true
      }
    ],
    mapDynamicValues: (action, mapper) => {
      const next = mapper(action.source, undefined);

      return next === action.source ? action : { ...action, source: next };
    },
    output: {
      path: "output",
      required: true,
      read: action => action.output,
      write: (action, next) => {
        return { ...action, output: next ?? "" };
      }
    }
  },
  refresh_data_source: {
    family: "effect",
    dataSourceId: {
      path: "dataSourceId",
      read: action => action.dataSourceId
    }
  },
  alert: {
    family: "effect",
    dynamicValues: action => [
      {
        path: "message",
        value: action.message,
        allowSteps: true
      }
    ],
    mapDynamicValues: (action, mapper) => {
      const next = mapper(action.message, undefined);

      return next === action.message ? action : { ...action, message: next };
    }
  },
  navigate: {
    family: "effect",
    dynamicValues: action => [
      {
        path: "to",
        value: action.to,
        allowSteps: true
      }
    ],
    mapDynamicValues: (action, mapper) => {
      const next = mapper(action.to, undefined);

      return next === action.to ? action : { ...action, to: next };
    }
  },
  submit: EMPTY_EFFECT_DESCRIPTOR,
  reset: EMPTY_EFFECT_DESCRIPTOR
};

/**
 * Look up the descriptor for a runtime action, or `undefined` when `action` is
 * malformed or carries an unknown type.
 */
export function getActionDescriptor(action: unknown): ActionDescriptor | undefined {
  if (!isRecord(action) || typeof action.type !== "string" || !Object.hasOwn(ACTION_DESCRIPTORS, action.type)) {
    return undefined;
  }

  return ACTION_DESCRIPTORS[action.type as LinkageActionType] as ActionDescriptor;
}

export function getActionDynamicValues(action: FieldLinkageAction): DynamicValueSlot[] {
  return getActionDescriptor(action)?.dynamicValues?.(action) ?? [];
}

export function mapActionDynamicValues(
  action: FieldLinkageAction,
  mapper: (value: DynamicValue, target: WriteTarget | undefined) => DynamicValue
): FieldLinkageAction {
  const descriptor = getActionDescriptor(action);

  return descriptor?.mapDynamicValues ? descriptor.mapDynamicValues(action, mapper) : action;
}

export function getActionTargetKeys(action: FieldLinkageAction): TargetKeySlot[] {
  return getActionDescriptor(action)?.targetKeys?.(action) ?? [];
}

export function mapActionTargetKeys(
  action: FieldLinkageAction,
  mapper: (targetKey: string) => string | undefined
): FieldLinkageAction | undefined {
  const descriptor = getActionDescriptor(action);

  return descriptor?.mapTargetKeys ? descriptor.mapTargetKeys(action, mapper) : action;
}

export function getActionOutput(action: FieldLinkageAction): { path: string; required: boolean; value: unknown } | undefined {
  const slot = getActionDescriptor(action)?.output;

  return slot
    ? {
        path: slot.path,
        required: slot.required,
        value: slot.read(action)
      }
    : undefined;
}

export function writeActionOutput<T extends FieldLinkageAction>(action: T, next: string | undefined): T {
  const slot = getActionDescriptor(action)?.output;

  // A descriptor's writer keeps its action's type; the lookup erased the pair.
  return slot ? slot.write(action, next) as T : action;
}

export function getActionRequests(action: FieldLinkageAction): RequestSlot[] {
  return getActionDescriptor(action)?.requests?.(action) ?? [];
}

export function getActionVariable(action: FieldLinkageAction): { path: string; value: unknown } | undefined {
  const slot = getActionDescriptor(action)?.variable;

  return slot ? { path: slot.path, value: slot.read(action) } : undefined;
}

export function rewriteActionVariable(action: FieldLinkageAction, name: string, nextName: string): FieldLinkageAction {
  const slot = getActionDescriptor(action)?.variable;

  return slot && slot.read(action) === name ? slot.write(action, nextName) : action;
}

export function getActionDataSourceId(action: FieldLinkageAction): { path: string; value: unknown } | undefined {
  const slot = getActionDescriptor(action)?.dataSourceId;

  return slot ? { path: slot.path, value: slot.read(action) } : undefined;
}
