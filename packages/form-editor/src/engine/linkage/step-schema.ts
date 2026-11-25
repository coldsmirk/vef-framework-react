import type {
  DataSourceApi,
  DataSourceApiField,
  DynamicValue,
  FieldAssignment,
  FieldLinkageAction,
  KeyedFormField,
  RemoteDataSourceRequest,
  SelectRecordColumn
} from "../../types";
import type { WritableTargetField } from "./validator";

import { nextUniqueKey } from "../keys";
import { isRecord, isValidIdentifier } from "../validation";
import {
  getActionDynamicValues,
  getActionOutput,
  mapActionDynamicValues
} from "./action-descriptors";
import { parseLeafSource } from "./scope";

/**
 * Pure designer-facing analysis and transformation helpers for ordered effect
 * action sequences: step output naming, downstream `$steps.<output>` reference
 * tracking and renaming, reorder safety checks, prior-step field schema
 * propagation (`api_call` → `select_record`), `select_record` auto-column
 * preview, and `set_fields` name-based auto-matching.
 */

export interface StepReferenceUsage {
  actionIndex: number;
  action: FieldLinkageAction;
  slotPath: string;
  path: string;
}

export interface BrokenStepReference {
  stepName: string;
  producerIndex: number;
  consumerIndex: number;
  consumerAction: FieldLinkageAction;
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

function matchCatalogApi(
  apis: readonly DataSourceApi[],
  request: RemoteDataSourceRequest
): DataSourceApi | undefined {
  const version = request.version ?? "";

  return apis.find(
    api => api.resource === request.resource
      && api.action === request.action
      && (api.version ?? "") === version
  );
}

function readActionOutputName(action: FieldLinkageAction): string | undefined {
  const slot = getActionOutput(action);

  return slot !== undefined && typeof slot.value === "string" && slot.value.length > 0
    ? slot.value
    : undefined;
}

/**
 * Collect every valid non-empty step output name declared in `actions`,
 * optionally skipping one index (used when validating or renaming that step's
 * own output).
 */
export function collectStepOutputNames(
  actions: readonly FieldLinkageAction[],
  excludeIndex?: number
): Set<string> {
  const used = new Set<string>();

  for (const [index, action] of actions.entries()) {
    if (index === excludeIndex) {
      continue;
    }

    const output = readActionOutputName(action);

    if (output !== undefined) {
      used.add(output);
    }
  }

  return used;
}

/**
 * Mint a rule-unique identifier for a step's `output` (`result`, `result_2`, …).
 */
export function nextUniqueStepOutput(
  actions: readonly FieldLinkageAction[],
  base: string,
  excludeIndex?: number
): string {
  return nextUniqueKey(collectStepOutputNames(actions, excludeIndex), base);
}

function collectActionStepUsages(
  action: FieldLinkageAction,
  actionIndex: number,
  stepName: string,
  usages: StepReferenceUsage[]
): void {
  for (const slot of getActionDynamicValues(action)) {
    if (!isRecord(slot.value) || slot.value.kind !== "reference" || typeof slot.value.path !== "string") {
      continue;
    }

    const parsed = parseLeafSource(slot.value.path);

    if (parsed.kind === "step" && parsed.step === stepName) {
      usages.push({
        actionIndex,
        action,
        slotPath: slot.path,
        path: slot.value.path
      });
    }
  }
}

/**
 * Collect every structured reference slot (`{ kind: "reference" }`) in
 * `actions[fromIndex..]` that reads `$steps.<stepName>` (whole or sub-path).
 */
export function collectStepReferenceUsages(
  actions: readonly FieldLinkageAction[],
  stepName: string,
  fromIndex = 0
): StepReferenceUsage[] {
  if (stepName.length === 0) {
    return [];
  }

  const usages: StepReferenceUsage[] = [];

  for (let index = Math.max(0, fromIndex); index < actions.length; index += 1) {
    const action = actions[index];

    if (action !== undefined) {
      collectActionStepUsages(action, index, stepName, usages);
    }
  }

  return usages;
}

/**
 * Subsequent steps (`j > index`) that reference the output produced by
 * `actions[index]`, deduplicated per step index. Used to warn before deleting
 * or clearing the output of a referenced step.
 */
export function findDependentStepsAfter(
  actions: readonly FieldLinkageAction[],
  index: number
): Array<{ index: number; action: FieldLinkageAction }> {
  const target = actions[index];

  if (target === undefined) {
    return [];
  }

  const output = readActionOutputName(target);

  if (output === undefined) {
    return [];
  }

  const usages = collectStepReferenceUsages(actions, output, index + 1);
  const seen = new Set<number>();
  const dependents: Array<{ index: number; action: FieldLinkageAction }> = [];

  for (const usage of usages) {
    if (seen.has(usage.actionIndex)) {
      continue;
    }

    seen.add(usage.actionIndex);
    dependents.push({ index: usage.actionIndex, action: usage.action });
  }

  return dependents;
}

function collectActionBrokenStepRefs(
  action: FieldLinkageAction,
  consumerIndex: number,
  producerByName: ReadonlyMap<string, number>,
  seen: Set<string>,
  broken: BrokenStepReference[]
): void {
  for (const slot of getActionDynamicValues(action)) {
    if (!isRecord(slot.value) || slot.value.kind !== "reference" || typeof slot.value.path !== "string") {
      continue;
    }

    const parsed = parseLeafSource(slot.value.path);

    if (parsed.kind !== "step") {
      continue;
    }

    const producerIndex = producerByName.get(parsed.step);

    if (producerIndex !== undefined && producerIndex >= consumerIndex) {
      const dedupeKey = `${parsed.step}:${consumerIndex}`;

      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        broken.push({
          stepName: parsed.step,
          producerIndex,
          consumerIndex,
          consumerAction: action
        });
      }
    }
  }
}

/**
 * Detect step references in `nextActions` whose producer now sits at or after
 * the consumer (e.g. dragging an `api_call` below the `select_record` or
 * `set_fields` that reads its output, or dragging a consumer above its
 * producer).
 */
export function findBrokenStepReferencesAfterReorder(
  nextActions: readonly FieldLinkageAction[]
): BrokenStepReference[] {
  const producerByName = new Map<string, number>();

  for (const [index, action] of nextActions.entries()) {
    const output = readActionOutputName(action);

    if (output !== undefined && !producerByName.has(output)) {
      producerByName.set(output, index);
    }
  }

  const broken: BrokenStepReference[] = [];
  const seen = new Set<string>();

  for (const [consumerIndex, action] of nextActions.entries()) {
    collectActionBrokenStepRefs(action, consumerIndex, producerByName, seen, broken);
  }

  return broken;
}

function rewriteStepReferenceValue(value: DynamicValue, oldName: string, nextName: string): DynamicValue {
  if (value.kind !== "reference") {
    return value;
  }

  const parsed = parseLeafSource(value.path);

  if (parsed.kind !== "step" || parsed.step !== oldName) {
    return value;
  }

  const nextPath = parsed.path.length > 0
    ? `$steps.${nextName}.${parsed.path.join(".")}`
    : `$steps.${nextName}`;

  return nextPath === value.path ? value : { ...value, path: nextPath };
}

/**
 * Update `actions[actionIndex]`'s `output` name and keep every subsequent
 * `$steps.<old>[.path]` reference in the same rule in sync. Stops rewriting if
 * an intermediate step shadows `oldName`.
 */
export function renameStepOutputInRule(
  actions: readonly FieldLinkageAction[],
  actionIndex: number,
  nextOutput: string | undefined
): FieldLinkageAction[] {
  const target = actions[actionIndex];

  if (target === undefined || (target.type !== "api_call" && target.type !== "select_record")) {
    return [...actions];
  }

  const trimmed = nextOutput?.trim();
  const normalizedNext = trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
  const oldOutput = readActionOutputName(target);

  let updatedTarget: FieldLinkageAction;

  if (target.type === "api_call") {
    if (normalizedNext === undefined) {
      const next = { ...target };
      delete next.output;
      updatedTarget = next;
    } else {
      updatedTarget = { ...target, output: normalizedNext };
    }
  } else {
    updatedTarget = { ...target, output: normalizedNext ?? "" };
  }

  const shouldPropagate = oldOutput !== undefined
    && normalizedNext !== undefined
    && oldOutput !== normalizedNext
    && isValidIdentifier(normalizedNext);

  let shadowed = false;

  return actions.map((action, index) => {
    if (index < actionIndex) {
      return action;
    }

    if (index === actionIndex) {
      return updatedTarget;
    }

    if (!shouldPropagate || shadowed) {
      return action;
    }

    const rewritten = mapActionDynamicValues(
      action,
      value => rewriteStepReferenceValue(value, oldOutput, normalizedNext)
    );

    if (readActionOutputName(action) === oldOutput) {
      shadowed = true;
    }

    return rewritten;
  });
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
  columns: readonly SelectRecordColumn[] | undefined
): readonly DataSourceApiField[] {
  if (columns === undefined || columns.length === 0) {
    return inherited;
  }

  const existing = new Set(inherited.map(field => field.path));
  const extras: DataSourceApiField[] = [];

  for (const column of columns) {
    const path = column.path.trim();

    if (path.length === 0 || existing.has(path)) {
      continue;
    }

    existing.add(path);
    extras.push({
      path,
      label: column.label.trim().length > 0 ? column.label.trim() : path
    });
  }

  return extras.length === 0 ? inherited : [...inherited, ...extras];
}

/**
 * Resolve every named output produced by steps strictly before `beforeIndex`,
 * propagating declared `DataSourceApi.fields` from `api_call` through
 * `select_record` when `select_record.source` references an earlier step.
 */
export function resolvePriorStepSchemas(
  actions: readonly FieldLinkageAction[],
  beforeIndex: number,
  apis: readonly DataSourceApi[]
): PriorStepSchema[] {
  const limit = Math.min(Math.max(0, beforeIndex), actions.length);
  const resolved: PriorStepSchema[] = [];
  const byOutput = new Map<string, PriorStepSchema>();

  for (let index = 0; index < limit; index += 1) {
    const action = actions[index];

    if (action === undefined) {
      continue;
    }

    if (action.type === "api_call") {
      const output = readActionOutputName(action);

      if (output === undefined) {
        continue;
      }

      const api = matchCatalogApi(apis, action.request);
      const fallbackEndpoint = action.request.resource.trim().length > 0 && action.request.action.trim().length > 0
        ? `${action.request.resource.trim()} / ${action.request.action.trim()}`
        : "接口结果";
      const entry: PriorStepSchema = {
        index,
        output,
        label: api?.label ?? fallbackEndpoint,
        kind: "api_call",
        fields: api?.fields ?? []
      };

      resolved.push(entry);
      byOutput.set(output, entry);
      continue;
    }

    if (action.type === "select_record") {
      const output = readActionOutputName(action);

      if (output === undefined) {
        continue;
      }

      let upstream: PriorStepSchema | undefined;
      let inheritedFields: readonly DataSourceApiField[] = [];

      if (action.source.kind === "reference") {
        const parsed = parseLeafSource(action.source.path);

        if (parsed.kind === "step") {
          upstream = byOutput.get(parsed.step);

          if (upstream !== undefined) {
            inheritedFields = projectStepFields(upstream.fields, parsed.path);
          }
        }
      }

      const title = action.title?.trim();
      const entry: PriorStepSchema = {
        index,
        output,
        label: title && title.length > 0
          ? title
          : upstream === undefined
            ? "选中记录"
            : `${upstream.label} · 选中记录`,
        kind: "select_record",
        fields: mergeDeclaredFields(inheritedFields, action.columns)
      };

      resolved.push(entry);
      byOutput.set(output, entry);
    }
  }

  return resolved;
}

/**
 * Resolve the declared record fields of the step that `actions[actionIndex]`
 * (`select_record`) draws from, so the column picker can offer them by label.
 */
export function resolveSelectRecordSourceFields(
  actions: readonly FieldLinkageAction[],
  actionIndex: number,
  apis: readonly DataSourceApi[]
): readonly DataSourceApiField[] {
  const action = actions[actionIndex];

  if (action?.type !== "select_record" || action.source.kind !== "reference") {
    return [];
  }

  const parsed = parseLeafSource(action.source.path);

  if (parsed.kind !== "step") {
    return [];
  }

  const prior = resolvePriorStepSchemas(actions, actionIndex, apis);
  const upstream = prior.find(step => step.output === parsed.step);

  return upstream === undefined ? [] : projectStepFields(upstream.fields, parsed.path);
}

function collectInferredFromAssignments(
  assignments: readonly FieldAssignment[],
  prefix: string,
  scopeFields: ReadonlyMap<string, KeyedFormField>,
  seen: Set<string>,
  inferred: SelectRecordColumn[]
): void {
  for (const assignment of assignments) {
    if (assignment.value.kind !== "reference" || !assignment.value.path.startsWith(prefix)) {
      continue;
    }

    const subPath = assignment.value.path.slice(prefix.length);

    if (subPath.length === 0 || seen.has(subPath)) {
      continue;
    }

    seen.add(subPath);
    const target = scopeFields.get(assignment.targetKey);
    const label = target?.label || (assignment.targetKey.length > 0 ? assignment.targetKey : subPath);

    inferred.push({ path: subPath, label });
  }
}

/**
 * Preview the display columns `select_record` will infer when `columns` is left
 * empty: every `$steps.<output>.<path>` referenced by subsequent `set_fields`
 * actions in the same rule, labelled by each target field's label. Mirrors
 * `runtime/record-selector.tsx`'s `inferSelectRecordColumns`.
 */
export function collectInferredSelectRecordColumns(
  output: string,
  remainingActions: readonly FieldLinkageAction[],
  scopeFields: ReadonlyMap<string, KeyedFormField>
): SelectRecordColumn[] {
  if (output.length === 0) {
    return [];
  }

  const prefix = `$steps.${output}.`;
  const seen = new Set<string>();
  const inferred: SelectRecordColumn[] = [];

  for (const next of remainingActions) {
    if (next.type === "set_fields") {
      collectInferredFromAssignments(next.assignments, prefix, scopeFields, seen, inferred);
    }
  }

  return inferred;
}

function lastPathSegment(path: string): string {
  const dot = path.lastIndexOf(".");

  return dot === -1 ? path : path.slice(dot + 1);
}

function isEmptyPlaceholderAssignment(assignment: FieldAssignment): boolean {
  return assignment.targetKey.length === 0
    && assignment.value.kind === "literal"
    && (assignment.value.value === "" || assignment.value.value === undefined);
}

/**
 * Match declared fields of `step` against unmapped same-scope writable target
 * controls — first by key (exact path, then last segment, then case-insensitive
 * key), then by trimmed field label. Existing mapped targets are never
 * overwritten; a sole untouched blank row is replaced cleanly when matches are
 * appended.
 */
export function matchStepFieldsToTargets(
  step: PriorStepSchema,
  targetFields: readonly WritableTargetField[],
  existingAssignments: readonly FieldAssignment[]
): FieldMatchResult {
  if (step.fields.length === 0 || step.output.length === 0) {
    return { added: [], nextAssignments: [...existingAssignments] };
  }

  const mappedKeys = new Set(
    existingAssignments
      .map(assignment => assignment.targetKey)
      .filter(key => key.length > 0)
  );
  const candidates = targetFields.filter(field => !mappedKeys.has(field.key));

  if (candidates.length === 0) {
    return { added: [], nextAssignments: [...existingAssignments] };
  }

  const exactByPath = new Map<string, DataSourceApiField>();
  const exactByLeaf = new Map<string, DataSourceApiField>();
  const lowerByPath = new Map<string, DataSourceApiField>();
  const lowerByLeaf = new Map<string, DataSourceApiField>();
  const byLabel = new Map<string, DataSourceApiField>();

  for (const apiField of step.fields) {
    const leaf = lastPathSegment(apiField.path);
    const trimmedLabel = apiField.label.trim();

    if (!exactByPath.has(apiField.path)) {
      exactByPath.set(apiField.path, apiField);
    }

    if (!exactByLeaf.has(leaf)) {
      exactByLeaf.set(leaf, apiField);
    }

    const lowerPath = apiField.path.toLowerCase();

    if (!lowerByPath.has(lowerPath)) {
      lowerByPath.set(lowerPath, apiField);
    }

    const lowerLeaf = leaf.toLowerCase();

    if (!lowerByLeaf.has(lowerLeaf)) {
      lowerByLeaf.set(lowerLeaf, apiField);
    }

    if (trimmedLabel.length > 0 && !byLabel.has(trimmedLabel)) {
      byLabel.set(trimmedLabel, apiField);
    }
  }

  const matchedByKey = new Map<string, DataSourceApiField>();

  // Pass 1: match by binding key (exact path → exact leaf → case-insensitive).
  for (const field of candidates) {
    const lowerKey = field.key.toLowerCase();
    const match = exactByPath.get(field.key)
      ?? exactByLeaf.get(field.key)
      ?? lowerByPath.get(lowerKey)
      ?? lowerByLeaf.get(lowerKey);

    if (match !== undefined) {
      matchedByKey.set(field.key, match);
    }
  }

  // Pass 2: match remaining controls by trimmed display label.
  for (const field of candidates) {
    if (matchedByKey.has(field.key)) {
      continue;
    }

    const label = field.label?.trim() ?? "";

    if (label.length === 0) {
      continue;
    }

    const match = byLabel.get(label);

    if (match !== undefined) {
      matchedByKey.set(field.key, match);
    }
  }

  // Emit assignments in the target controls' visual/declaration order.
  const added: FieldAssignment[] = [];

  for (const field of candidates) {
    const match = matchedByKey.get(field.key);

    if (match !== undefined) {
      added.push({
        targetKey: field.key,
        value: {
          kind: "reference",
          path: `$steps.${step.output}.${match.path}`
        }
      });
    }
  }

  if (added.length === 0) {
    return { added: [], nextAssignments: [...existingAssignments] };
  }

  const base = existingAssignments.length === 1
    && existingAssignments[0] !== undefined
    && isEmptyPlaceholderAssignment(existingAssignments[0])
    ? []
    : existingAssignments;

  return {
    added,
    nextAssignments: [...base, ...added]
  };
}
