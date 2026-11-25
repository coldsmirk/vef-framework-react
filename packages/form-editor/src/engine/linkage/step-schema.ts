import type {
  DataSourceApi,
  DataSourceApiField,
  DynamicValue,
  FieldAssignment,
  FieldLinkageAction,
  KeyedFormField,
  SelectRecordColumn
} from "../../types";
import type { WritableTargetField } from "./validator";

import { findDataSourceApi } from "../data-source-apis";
import { nextUniqueKey } from "../keys";
import { isRecord, isValidIdentifier } from "../validation";
import { getActionDynamicValues, getActionOutput, mapActionDynamicValues, writeActionOutput } from "./action-descriptors";
import { parseLeafSource } from "./scope";

/**
 * What an ordered action sequence's steps are named, which later steps read
 * them, and the record fields those results are known to carry. Shared by the
 * designer, which edits sequences, and the runtime's record picker.
 */

export interface BrokenStepReference {
  stepName: string;
  producerIndex: number;
  consumerIndex: number;
}

export interface PriorStepSchema {
  index: number;
  output: string;
  label: string;
  kind: "api_call" | "select_record";
  fields: readonly DataSourceApiField[];
}

export interface FieldMatchResult {
  added: FieldAssignment[];
  nextAssignments: FieldAssignment[];
}

/**
 * The name a step's result is stored under, or `undefined` for a step that
 * stores none.
 */
export function getStepOutputName(action: FieldLinkageAction): string | undefined {
  const value = getActionOutput(action)?.value;

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Every output name declared in `actions`, optionally leaving out one step
 * (the one being named).
 */
export function collectStepOutputNames(
  actions: readonly FieldLinkageAction[],
  excludeIndex?: number
): Set<string> {
  const used = new Set<string>();

  for (const [index, action] of actions.entries()) {
    const output = index === excludeIndex ? undefined : getStepOutputName(action);

    if (output !== undefined) {
      used.add(output);
    }
  }

  return used;
}

/**
 * Mint a rule-unique output name (`result`, `result_2`, …).
 */
export function nextUniqueStepOutput(
  actions: readonly FieldLinkageAction[],
  base: string,
  excludeIndex?: number
): string {
  return nextUniqueKey(collectStepOutputNames(actions, excludeIndex), base);
}

/**
 * The step names an action's `{ kind: "reference" }` values read.
 */
function collectReferencedSteps(action: FieldLinkageAction): Set<string> {
  const names = new Set<string>();

  for (const slot of getActionDynamicValues(action)) {
    if (!isRecord(slot.value) || slot.value.kind !== "reference" || typeof slot.value.path !== "string") {
      continue;
    }

    const parsed = parseLeafSource(slot.value.path);

    if (parsed.kind === "step") {
      names.add(parsed.step);
    }
  }

  return names;
}

/**
 * The indexes of the steps after `index` that read its output.
 */
export function findDependentStepsAfter(actions: readonly FieldLinkageAction[], index: number): number[] {
  const target = actions[index];
  const output = target === undefined ? undefined : getStepOutputName(target);

  if (output === undefined) {
    return [];
  }

  return actions.flatMap((action, current) => current > index && collectReferencedSteps(action).has(output) ? [current] : []);
}

/**
 * The step references whose producer sits at or after the step reading it, as
 * a reorder can leave them.
 */
export function findBrokenStepReferences(actions: readonly FieldLinkageAction[]): BrokenStepReference[] {
  const producerByName = new Map<string, number>();

  for (const [index, action] of actions.entries()) {
    const output = getStepOutputName(action);

    if (output !== undefined && !producerByName.has(output)) {
      producerByName.set(output, index);
    }
  }

  return actions.flatMap((action, consumerIndex) => [...collectReferencedSteps(action)].flatMap(stepName => {
    const producerIndex = producerByName.get(stepName);

    return producerIndex !== undefined && producerIndex >= consumerIndex
      ? [
          {
            stepName,
            producerIndex,
            consumerIndex
          }
        ]
      : [];
  }));
}

function renameReferencedStep(value: DynamicValue, oldName: string, nextName: string): DynamicValue {
  if (value.kind !== "reference") {
    return value;
  }

  const parsed = parseLeafSource(value.path);

  if (parsed.kind !== "step" || parsed.step !== oldName) {
    return value;
  }

  return { ...value, path: ["$steps", nextName, ...parsed.path].join(".") };
}

/**
 * Rename a step's output (`undefined` or blank clears it) and carry every
 * reference to it in the steps that follow, up to one that redefines the old
 * name.
 */
export function renameStepOutputInRule(
  actions: readonly FieldLinkageAction[],
  actionIndex: number,
  nextOutput: string | undefined
): FieldLinkageAction[] {
  const target = actions[actionIndex];

  if (target === undefined) {
    return [...actions];
  }

  const nextName = nextOutput?.trim() || undefined;
  const oldName = getStepOutputName(target);
  const renamed = actions.with(actionIndex, writeActionOutput(target, nextName));

  if (oldName === undefined || nextName === undefined || !isValidIdentifier(nextName)) {
    return renamed;
  }

  for (const [index, action] of actions.entries()) {
    if (index <= actionIndex) {
      continue;
    }

    renamed[index] = mapActionDynamicValues(action, value => renameReferencedStep(value, oldName, nextName));

    if (getStepOutputName(action) === oldName) {
      break;
    }
  }

  return renamed;
}

function indexFirst<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T> {
  const index = new Map<string, T>();

  for (const item of items) {
    const key = keyOf(item);

    if (key.length > 0 && !index.has(key)) {
      index.set(key, item);
    }
  }

  return index;
}

function projectStepFields(
  fields: readonly DataSourceApiField[],
  subPath: readonly string[]
): readonly DataSourceApiField[] {
  if (subPath.length === 0) {
    return fields;
  }

  const prefix = `${subPath.join(".")}.`;

  return fields
    .filter(field => field.path.startsWith(prefix))
    .map(field => {
      return {
        path: field.path.slice(prefix.length),
        label: field.label
      };
    });
}

function mergeDeclaredFields(
  inherited: readonly DataSourceApiField[],
  columns: readonly SelectRecordColumn[] = []
): readonly DataSourceApiField[] {
  const declared = columns.map(column => {
    const path = column.path.trim();

    return { path, label: column.label.trim() || path };
  });

  return indexFirst([...inherited, ...declared], field => field.path).values().toArray();
}

/**
 * The step a `select_record` draws from and the declared fields of what it
 * selects among.
 */
function resolveRecordSource(
  source: DynamicValue,
  priorSteps: readonly PriorStepSchema[]
): { step: PriorStepSchema; fields: readonly DataSourceApiField[] } | undefined {
  const parsed = source.kind === "reference" ? parseLeafSource(source.path) : undefined;

  if (parsed?.kind !== "step") {
    return undefined;
  }

  const step = priorSteps.find(candidate => candidate.output === parsed.step);

  return step && { step, fields: projectStepFields(step.fields, parsed.path) };
}

function describeStep(
  action: FieldLinkageAction,
  priorSteps: readonly PriorStepSchema[],
  apis: readonly DataSourceApi[]
): Pick<PriorStepSchema, "fields" | "kind" | "label"> | undefined {
  if (action.type === "api_call") {
    const api = findDataSourceApi(apis, action.request);
    const endpoint = [action.request.resource.trim(), action.request.action.trim()];

    return {
      kind: "api_call",
      label: api?.label ?? (endpoint.every(part => part.length > 0) ? endpoint.join(" / ") : "接口结果"),
      fields: api?.fields ?? []
    };
  }

  if (action.type === "select_record") {
    const source = resolveRecordSource(action.source, priorSteps);

    return {
      kind: "select_record",
      label: action.title?.trim() || (source === undefined ? "选中记录" : `${source.step.label} · 选中记录`),
      fields: mergeDeclaredFields(source?.fields ?? [], action.columns)
    };
  }

  return undefined;
}

/**
 * The named results of the steps before `beforeIndex`, with the record fields
 * each is declared to carry: an `api_call`'s from the API catalog, a
 * `select_record`'s from the step it draws from.
 */
export function resolvePriorStepSchemas(
  actions: readonly FieldLinkageAction[],
  beforeIndex: number,
  apis: readonly DataSourceApi[]
): PriorStepSchema[] {
  const resolved: PriorStepSchema[] = [];

  const earlier = actions.slice(0, beforeIndex);

  for (const [index, action] of earlier.entries()) {
    const output = getStepOutputName(action);
    const description = output === undefined ? undefined : describeStep(action, resolved, apis);

    if (output !== undefined && description !== undefined) {
      resolved.push({
        index,
        output,
        ...description
      });
    }
  }

  return resolved;
}

/**
 * The declared fields of the records a `select_record` selects among.
 */
export function resolveRecordSourceFields(
  source: DynamicValue,
  priorSteps: readonly PriorStepSchema[]
): readonly DataSourceApiField[] {
  return resolveRecordSource(source, priorSteps)?.fields ?? [];
}

/**
 * The columns a `select_record` without its own shows: what the `set_fields`
 * steps after it read from its result, under each target field's label.
 * Tolerates malformed steps, since the runtime calls it on stored schemas.
 */
export function collectInferredSelectRecordColumns(
  output: string,
  remainingActions: readonly FieldLinkageAction[],
  scopeFields: ReadonlyMap<string, Pick<KeyedFormField, "label">>
): SelectRecordColumn[] {
  if (output.length === 0) {
    return [];
  }

  const prefix = `$steps.${output}.`;
  const columns = remainingActions.flatMap(action => getActionDynamicValues(action)).flatMap(({ target, value }) => {
    const reference = isRecord(value) && value.kind === "reference" ? value.path : undefined;

    if (target?.kind !== "field" || typeof reference !== "string" || !reference.startsWith(prefix)) {
      return [];
    }

    const path = reference.slice(prefix.length);

    return [{ path, label: scopeFields.get(target.key)?.label || target.key || path }];
  });

  return indexFirst(columns, column => column.path).values().toArray();
}

function lastPathSegment(path: string): string {
  return path.slice(path.lastIndexOf(".") + 1);
}

function isUntouchedAssignment(assignment: FieldAssignment): boolean {
  return assignment.targetKey.length === 0
    && assignment.value.kind === "literal"
    && (assignment.value.value === "" || assignment.value.value === undefined);
}

/**
 * Map a step's declared fields onto the writable controls nothing writes yet:
 * by binding key (exact path, its last segment, then either case-insensitively),
 * else by label. Existing assignments stay as they are, except that rows left
 * blank make way when nothing else is mapped yet.
 */
export function matchStepFieldsToTargets(
  step: PriorStepSchema,
  targetFields: readonly WritableTargetField[],
  existingAssignments: readonly FieldAssignment[]
): FieldMatchResult {
  const mappedKeys = new Set(existingAssignments.map(assignment => assignment.targetKey));
  const byPath = indexFirst(step.fields, field => field.path);
  const bySegment = indexFirst(step.fields, field => lastPathSegment(field.path));
  const byLowerPath = indexFirst(step.fields, field => field.path.toLowerCase());
  const byLowerSegment = indexFirst(step.fields, field => lastPathSegment(field.path).toLowerCase());
  const byLabel = indexFirst(step.fields, field => field.label.trim());

  // Assignments follow the target controls' order in the form.
  const added = targetFields.flatMap((target): FieldAssignment[] => {
    if (mappedKeys.has(target.key)) {
      return [];
    }

    const lowerKey = target.key.toLowerCase();
    const match = byPath.get(target.key)
      ?? bySegment.get(target.key)
      ?? byLowerPath.get(lowerKey)
      ?? byLowerSegment.get(lowerKey)
      ?? byLabel.get(target.label?.trim() ?? "");

    return match === undefined
      ? []
      : [{ targetKey: target.key, value: { kind: "reference", path: `$steps.${step.output}.${match.path}` } }];
  });

  const kept = added.length > 0 && existingAssignments.every(assignment => isUntouchedAssignment(assignment)) ? [] : existingAssignments;

  return { added, nextAssignments: [...kept, ...added] };
}
