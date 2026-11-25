import type {
  Block,
  DateGranularity,
  DynamicValue,
  FieldLinkage,
  FieldLinkageAction,
  FieldLinkageRule,
  FieldOptionSource,
  FormDataSource,
  FormField,
  FormSchema,
  LinkageCondition,
  PresentationLayer
} from "../../types";
import type { ScopeKeyBucket } from "../keys";
import type { ScopePath } from "./walk";

import { assertNever } from "../assert-never";
import {
  getActionConditions,
  getActionDataSourceId,
  getActionDynamicValues,
  mapActionConditions,
  mapActionDynamicValues,
  mapActionTargetKeys,
  mapRemoteRequestDynamicValues,
  rewriteActionVariable
} from "../linkage/action-descriptors";
import { leafSourceFormKey, withLeafSourceFormKey, withLeafSourceVariableName } from "../linkage/scope";
import { getTriggerCondition, mapTriggerCondition } from "../linkage/shape";
import { isDateLiteralCompatible, isEmptyDateLiteral } from "./date-granularity";
import { bodyScopeKey, mapPreservingIdentity } from "./nodes";
import { rewriteContainerBodies } from "./rewrite";
import { isContainerNode, isLeafField, isRootScope, scopeEquals, walkNodes } from "./walk";

/**
 * Reference-consistency reconciliation. Structural edits (remove / rename),
 * declaration edits (variables / data sources), and date-granularity switches
 * can leave the rest of the schema pointing at things that no longer exist or
 * literals that no longer match the target format; the functions here rewrite,
 * prune, or scrub those references so the editor never emits a broken schema.
 *
 * All action traversals route exclusively through the central action
 * descriptors (`engine/linkage/action-descriptors.ts`), and all trigger
 * condition/guard traversals through `getTriggerCondition` /
 * `mapTriggerCondition` (`engine/linkage/shape.ts`).
 */

/* ----------------------------------------------------------- tree plumbing */

type NodePatch = (node: Block, scope: ScopePath) => Block;

function reconcileBlocks(blocks: Block[], scope: ScopePath, patch: NodePatch): Block[] {
  return mapPreservingIdentity(blocks, block => reconcileBlock(block, scope, patch));
}

function reconcileBlock(block: Block, scope: ScopePath, patch: NodePatch): Block {
  const patched = patch(block, scope);

  if (!isContainerNode(patched)) {
    return patched;
  }

  const key = bodyScopeKey(patched);
  const inner: ScopePath = key === undefined ? scope : [...scope, key];

  return rewriteContainerBodies(patched, body => reconcileBlocks(body, inner, patch));
}

function reconcileLayer(layer: PresentationLayer, patch: NodePatch): PresentationLayer {
  const children = reconcileBlocks(layer.children, [], patch);

  return children === layer.children ? layer : { ...layer, children };
}

function mapPresentations(schema: FormSchema, transform: (layer: PresentationLayer) => PresentationLayer): FormSchema {
  const pc = transform(schema.presentations.pc);
  const mobile = schema.presentations.mobile === undefined ? undefined : transform(schema.presentations.mobile);

  if (pc === schema.presentations.pc && mobile === schema.presentations.mobile) {
    return schema;
  }

  return {
    ...schema,
    presentations: mobile === undefined ? { pc } : { pc, mobile }
  };
}

function reconcileFormLinkage(schema: FormSchema, transform: (linkage: FieldLinkage) => FieldLinkage): FormSchema {
  if (schema.linkage === undefined) {
    return schema;
  }

  const linkage = transform(schema.linkage);

  return linkage === schema.linkage ? schema : { ...schema, linkage };
}

function mapOptionSourceDynamicValues(
  source: FieldOptionSource | undefined,
  mapper: (value: DynamicValue) => DynamicValue
): FieldOptionSource | undefined {
  if (source?.kind !== "remote") {
    return source;
  }

  const nextRequest = mapRemoteRequestDynamicValues(source.request, mapper);

  return nextRequest === source.request ? source : { ...source, request: nextRequest };
}

function mapNodeOptionSourceDynamicValues(
  node: Block,
  mapper: (value: DynamicValue) => DynamicValue
): Block {
  if (isLeafField(node)) {
    const field = node as FormField & { dataSource?: FieldOptionSource };

    if (field.dataSource === undefined) {
      return node;
    }

    const nextSource = mapOptionSourceDynamicValues(field.dataSource, mapper);

    return nextSource === field.dataSource ? node : ({ ...node, dataSource: nextSource } as Block);
  }

  if (node.type === "subform" && node.rows?.mode === "fixed") {
    const nextSource = mapOptionSourceDynamicValues(node.rows.source, mapper);

    return nextSource === node.rows.source || nextSource === undefined
      ? node
      : { ...node, rows: { ...node.rows, source: nextSource } };
  }

  return node;
}

function mapFormDataSourcesDynamicValues(
  dataSources: FormDataSource[] | undefined,
  mapper: (value: DynamicValue) => DynamicValue
): FormDataSource[] | undefined {
  if (dataSources === undefined) {
    return dataSources;
  }

  return mapPreservingIdentity(dataSources, source => {
    if (source.kind !== "remote") {
      return source;
    }

    const nextRequest = mapRemoteRequestDynamicValues(source.request, mapper);

    return nextRequest === source.request ? source : { ...source, request: nextRequest };
  });
}

/* ------------------------------------------------------------- key renames */

function renameDynamicValueKey(value: DynamicValue, oldKey: string, newKey: string): DynamicValue {
  if (value.kind !== "reference") {
    return value;
  }

  return leafSourceFormKey(value.path) === oldKey
    ? { ...value, path: withLeafSourceFormKey(value.path, newKey) }
    : value;
}

function renameConditionKeys(condition: LinkageCondition, oldKey: string, newKey: string): LinkageCondition {
  switch (condition.kind) {
    case "leaf": {
      return leafSourceFormKey(condition.sourceKey) === oldKey
        ? { ...condition, sourceKey: withLeafSourceFormKey(condition.sourceKey, newKey) }
        : condition;
    }

    case "group": {
      const children = mapPreservingIdentity(condition.children, child => renameConditionKeys(child, oldKey, newKey));

      return children === condition.children ? condition : { ...condition, children };
    }

    case "expression": {
      // Expression sources are opaque host code — never rewritten.
      return condition;
    }

    default: {
      return assertNever(condition);
    }
  }
}

function renameActionKeys(action: FieldLinkageAction, oldKey: string, newKey: string): FieldLinkageAction {
  let next = mapActionTargetKeys(action, targetKey => targetKey === oldKey ? newKey : targetKey) ?? action;

  next = mapActionDynamicValues(next, value => renameDynamicValueKey(value, oldKey, newKey));
  next = mapActionConditions(next, condition => renameConditionKeys(condition, oldKey, newKey)) ?? next;

  return next;
}

function renameRuleKeys(rule: FieldLinkageRule, oldKey: string, newKey: string): FieldLinkageRule {
  const trigger = mapTriggerCondition(rule.trigger, condition => renameConditionKeys(condition, oldKey, newKey)) ?? rule.trigger;
  const actions = mapPreservingIdentity(rule.actions, action => renameActionKeys(action, oldKey, newKey));

  return trigger === rule.trigger && actions === rule.actions
    ? rule
    : {
        ...rule,
        trigger,
        actions
      };
}

/**
 * Rewrite every form-key reference (`leaf.sourceKey`, trigger `when`, action
 * target keys, and `reference` dynamic values) inside one linkage payload.
 */
export function renameLinkageKeyReferences(linkage: FieldLinkage, oldKey: string, newKey: string): FieldLinkage {
  if (!linkage.rules) {
    return linkage;
  }

  const rules = mapPreservingIdentity(linkage.rules, rule => renameRuleKeys(rule, oldKey, newKey));

  return rules === linkage.rules ? linkage : { ...linkage, rules };
}

/**
 * Rewrite form-key `reference` params on form-global remote `dataSources`.
 */
export function renameDataSourcesKeyReferences(
  dataSources: FormDataSource[] | undefined,
  oldKey: string,
  newKey: string
): FormDataSource[] | undefined {
  return mapFormDataSourcesDynamicValues(dataSources, value => renameDynamicValueKey(value, oldKey, newKey));
}

/**
 * Rewrite form-key references in linkage rules and remote option-source params
 * across the layer for nodes whose scope matches `scope`.
 */
export function renameKeyReferences(
  layer: PresentationLayer,
  scope: ScopePath,
  oldKey: string,
  newKey: string
): PresentationLayer {
  return reconcileLayer(layer, (node, nodeScope) => {
    if (!scopeEquals(nodeScope, scope)) {
      return node;
    }

    let next = mapNodeOptionSourceDynamicValues(node, value => renameDynamicValueKey(value, oldKey, newKey));

    if (next.linkage !== undefined) {
      const linkage = renameLinkageKeyReferences(next.linkage, oldKey, newKey);

      if (linkage !== next.linkage) {
        next = { ...next, linkage };
      }
    }

    return next;
  });
}

/* -------------------------------------------------------------- key prunes */

function pruneDynamicValueKeys(value: DynamicValue, removedKeys: ReadonlySet<string>): DynamicValue {
  if (value.kind !== "reference") {
    return value;
  }

  const key = leafSourceFormKey(value.path);

  return key !== undefined && removedKeys.has(key) ? { ...value, path: "" } : value;
}

function pruneCondition(condition: LinkageCondition, removedKeys: ReadonlySet<string>): LinkageCondition | undefined {
  switch (condition.kind) {
    case "leaf": {
      const key = leafSourceFormKey(condition.sourceKey);

      return key !== undefined && removedKeys.has(key) ? undefined : condition;
    }

    case "group": {
      const survivors: LinkageCondition[] = [];
      let changed = false;

      for (const child of condition.children) {
        const pruned = pruneCondition(child, removedKeys);

        if (pruned === undefined) {
          changed = true;
          continue;
        }

        if (pruned !== child) {
          changed = true;
        }

        survivors.push(pruned);
      }

      if (!changed) {
        return condition;
      }

      return survivors.length === 0 ? undefined : { ...condition, children: survivors };
    }

    case "expression": {
      return condition;
    }

    default: {
      return assertNever(condition);
    }
  }
}

function pruneActionKeys(action: FieldLinkageAction, removedKeys: ReadonlySet<string>): FieldLinkageAction | undefined {
  const afterTargets = mapActionTargetKeys(action, targetKey => removedKeys.has(targetKey) ? undefined : targetKey);

  if (afterTargets === undefined) {
    return undefined;
  }

  const afterValues = mapActionDynamicValues(afterTargets, value => pruneDynamicValueKeys(value, removedKeys));

  return mapActionConditions(afterValues, condition => pruneCondition(condition, removedKeys));
}

function pruneRuleKeys(rule: FieldLinkageRule, removedKeys: ReadonlySet<string>): FieldLinkageRule | undefined {
  const trigger = mapTriggerCondition(rule.trigger, condition => pruneCondition(condition, removedKeys));

  if (trigger === undefined) {
    return undefined;
  }

  const actions: FieldLinkageAction[] = [];
  let actionsChanged = false;
  let droppedAction = false;

  for (const action of rule.actions) {
    const pruned = pruneActionKeys(action, removedKeys);

    if (pruned === undefined) {
      actionsChanged = true;
      droppedAction = true;
      continue;
    }

    if (pruned !== action) {
      actionsChanged = true;
    }

    actions.push(pruned);
  }

  if (trigger === rule.trigger && !actionsChanged) {
    return rule;
  }

  if (droppedAction && actions.length === 0) {
    return undefined;
  }

  return {
    ...rule,
    trigger,
    actions: actionsChanged ? actions : rule.actions
  };
}

/**
 * Prune every reference to a removed key inside one linkage payload. Cascades
 * bottom-up: leaf → enclosing group → rule (both `condition` triggers and event
 * `when` guards), target assignment → action → rule, and clears dangling
 * `reference` dynamic values to `path: ""` so a future key reuse cannot
 * silently rebind them.
 */
export function pruneLinkageKeyReferences(linkage: FieldLinkage, removedKeys: ReadonlySet<string>): FieldLinkage {
  if (!linkage.rules) {
    return linkage;
  }

  const rules: FieldLinkageRule[] = [];
  let changed = false;

  for (const rule of linkage.rules) {
    const pruned = pruneRuleKeys(rule, removedKeys);

    if (pruned === undefined) {
      changed = true;
      continue;
    }

    if (pruned !== rule) {
      changed = true;
    }

    rules.push(pruned);
  }

  return changed ? { ...linkage, rules } : linkage;
}

/**
 * Clear dangling form-key `reference` params on form-global remote
 * `dataSources` when PC root-scope keys are removed.
 */
export function pruneDataSourcesKeyReferences(
  dataSources: FormDataSource[] | undefined,
  buckets: readonly ScopeKeyBucket[]
): FormDataSource[] | undefined {
  const rootBucket = buckets.find(bucket => isRootScope(bucket.scope));

  if (rootBucket === undefined || rootBucket.keys.size === 0) {
    return dataSources;
  }

  return mapFormDataSourcesDynamicValues(dataSources, value => pruneDynamicValueKeys(value, rootBucket.keys));
}

export function pruneKeyReferences(
  layer: PresentationLayer,
  scope: ScopePath,
  removedKeys: ReadonlySet<string>
): PresentationLayer {
  if (removedKeys.size === 0) {
    return layer;
  }

  return reconcileLayer(layer, (node, nodeScope) => {
    if (!scopeEquals(nodeScope, scope)) {
      return node;
    }

    let next = mapNodeOptionSourceDynamicValues(node, value => pruneDynamicValueKeys(value, removedKeys));

    if (next.linkage !== undefined) {
      const linkage = pruneLinkageKeyReferences(next.linkage, removedKeys);

      if (linkage !== next.linkage) {
        next = { ...next, linkage };
      }
    }

    return next;
  });
}

export function pruneScopedReferences(layer: PresentationLayer, buckets: readonly ScopeKeyBucket[]): PresentationLayer {
  let next = layer;

  for (const bucket of buckets) {
    next = pruneKeyReferences(next, bucket.scope, bucket.keys);
  }

  return next;
}

export function pruneFormLinkageForRootBucket(linkage: FieldLinkage, buckets: readonly ScopeKeyBucket[]): FieldLinkage {
  const rootBucket = buckets.find(bucket => isRootScope(bucket.scope));

  return rootBucket ? pruneLinkageKeyReferences(linkage, rootBucket.keys) : linkage;
}

/* --------------------------------------------------------------- variables */

function renameDynamicValueVariable(value: DynamicValue, name: string, nextName: string): DynamicValue {
  if (value.kind !== "reference") {
    return value;
  }

  const nextPath = withLeafSourceVariableName(value.path, name, nextName);

  return nextPath === value.path ? value : { ...value, path: nextPath };
}

function renameConditionVariables(condition: LinkageCondition, name: string, nextName: string): LinkageCondition {
  switch (condition.kind) {
    case "leaf": {
      const nextSourceKey = withLeafSourceVariableName(condition.sourceKey, name, nextName);

      return nextSourceKey === condition.sourceKey ? condition : { ...condition, sourceKey: nextSourceKey };
    }

    case "group": {
      const children = mapPreservingIdentity(condition.children, child => renameConditionVariables(child, name, nextName));

      return children === condition.children ? condition : { ...condition, children };
    }

    case "expression": {
      return condition;
    }

    default: {
      return assertNever(condition);
    }
  }
}

function renameActionVariables(action: FieldLinkageAction, name: string, nextName: string): FieldLinkageAction {
  let next = rewriteActionVariable(action, name, nextName);

  next = mapActionDynamicValues(next, value => renameDynamicValueVariable(value, name, nextName));
  next = mapActionConditions(next, condition => renameConditionVariables(condition, name, nextName)) ?? next;

  return next;
}

function renameLinkageVariableReferences(linkage: FieldLinkage, name: string, nextName: string): FieldLinkage {
  if (!linkage.rules) {
    return linkage;
  }

  const rules = mapPreservingIdentity(linkage.rules, rule => {
    const trigger = mapTriggerCondition(rule.trigger, condition => renameConditionVariables(condition, name, nextName)) ?? rule.trigger;
    const actions = mapPreservingIdentity(rule.actions, action => renameActionVariables(action, name, nextName));

    return trigger === rule.trigger && actions === rule.actions
      ? rule
      : {
          ...rule,
          trigger,
          actions
        };
  });

  return rules === linkage.rules ? linkage : { ...linkage, rules };
}

/**
 * Rewrite every variable reference (`set_variable` targets, `$vars.<name>`
 * condition/guard leaves, `$vars.<name>` reference dynamic values in actions
 * and remote option sources) across both presentations, form-global
 * `dataSources`, and `schema.linkage`.
 */
export function renameVariableReferences(schema: FormSchema, name: string, nextName: string): FormSchema {
  let next = reconcileFormLinkage(
    mapPresentations(schema, layer => reconcileLayer(layer, node => {
      let updated = mapNodeOptionSourceDynamicValues(node, value => renameDynamicValueVariable(value, name, nextName));

      if (updated.linkage !== undefined) {
        const linkage = renameLinkageVariableReferences(updated.linkage, name, nextName);

        if (linkage !== updated.linkage) {
          updated = { ...updated, linkage };
        }
      }

      return updated;
    })),
    linkage => renameLinkageVariableReferences(linkage, name, nextName)
  );

  const nextDataSources = mapFormDataSourcesDynamicValues(
    next.dataSources,
    value => renameDynamicValueVariable(value, name, nextName)
  );

  if (nextDataSources !== next.dataSources && nextDataSources !== undefined) {
    next = { ...next, dataSources: nextDataSources };
  }

  return next;
}

/* ------------------------------------------------------------ data sources */

function pruneFieldDataSource(field: FormField, dataSourceId: string): FormField {
  const { dataSource } = field as { dataSource?: FieldOptionSource };

  if (dataSource === undefined || dataSource.kind !== "ref" || dataSource.dataSourceId !== dataSourceId) {
    return field;
  }

  const next = { ...field } as FormField & { dataSource?: FieldOptionSource };

  delete next.dataSource;

  return next;
}

function pruneRuleDataSource(rule: FieldLinkageRule, dataSourceId: string): FieldLinkageRule | undefined {
  const actions: FieldLinkageAction[] = [];
  let changed = false;

  for (const action of rule.actions) {
    const slot = getActionDataSourceId(action);

    if (slot !== undefined && slot.value === dataSourceId) {
      changed = true;
      continue;
    }

    actions.push(action);
  }

  if (!changed) {
    return rule;
  }

  return actions.length === 0 ? undefined : { ...rule, actions };
}

function pruneLinkageDataSourceReferences(linkage: FieldLinkage, dataSourceId: string): FieldLinkage {
  if (!linkage.rules) {
    return linkage;
  }

  const rules: FieldLinkageRule[] = [];
  let changed = false;

  for (const rule of linkage.rules) {
    const pruned = pruneRuleDataSource(rule, dataSourceId);

    if (pruned === undefined) {
      changed = true;
      continue;
    }

    if (pruned !== rule) {
      changed = true;
    }

    rules.push(pruned);
  }

  return changed ? { ...linkage, rules } : linkage;
}

export function pruneDataSourceReferences(schema: FormSchema, dataSourceId: string): FormSchema {
  return reconcileFormLinkage(
    mapPresentations(schema, layer => reconcileLayer(layer, node => {
      let result = node;

      if (isLeafField(result)) {
        result = pruneFieldDataSource(result, dataSourceId);
      } else if (
        result.type === "subform"
        && result.rows?.mode === "fixed"
        && result.rows.source.kind === "ref"
        && result.rows.source.dataSourceId === dataSourceId
      ) {
        result = {
          ...result,
          rows: {
            ...result.rows,
            source: { kind: "ref", dataSourceId: "" }
          }
        };
      }

      if (result.linkage !== undefined) {
        const linkage = pruneLinkageDataSourceReferences(result.linkage, dataSourceId);

        if (linkage !== result.linkage) {
          result = { ...result, linkage };
        }
      }

      return result;
    })),
    linkage => pruneLinkageDataSourceReferences(linkage, dataSourceId)
  );
}

/* -------------------------------------------------------- date granularity */

export interface DateGranularityScrubTarget {
  key: string;
  fieldType: "date" | "daterange";
  nextGranularity: DateGranularity;
}

type DateConditionLeaf = Extract<LinkageCondition, { kind: "leaf" }>;

function isTargetDateConditionLeaf(condition: DateConditionLeaf, key: string): boolean {
  return leafSourceFormKey(condition.sourceKey) === key
    && condition.operator !== "empty"
    && condition.operator !== "notEmpty";
}

function matchesDateTargetSlot(
  targetKey: string | "self" | undefined,
  key: string,
  includeOwnAssign: boolean
): boolean {
  return targetKey === key || (includeOwnAssign && targetKey === "self");
}

function conditionHasDateLiterals(condition: LinkageCondition, key: string): boolean {
  switch (condition.kind) {
    case "leaf": {
      return isTargetDateConditionLeaf(condition, key) && !isEmptyDateLiteral(condition.value);
    }

    case "group": {
      return condition.children.some(child => conditionHasDateLiterals(child, key));
    }

    case "expression": {
      return false;
    }

    default: {
      return assertNever(condition);
    }
  }
}

function actionHasDateLiterals(action: FieldLinkageAction, key: string, includeOwnAssign: boolean): boolean {
  for (const slot of getActionDynamicValues(action)) {
    if (
      matchesDateTargetSlot(slot.targetKey, key, includeOwnAssign)
      && typeof slot.value === "object"
      && slot.value !== null
      && (slot.value as DynamicValue).kind === "literal"
      && !isEmptyDateLiteral((slot.value as { kind: "literal"; value: unknown }).value)
    ) {
      return true;
    }
  }

  for (const slot of getActionConditions(action)) {
    if (conditionHasDateLiterals(slot.condition as LinkageCondition, key)) {
      return true;
    }
  }

  return false;
}

export function hasLinkageDateLiterals(
  linkage: FieldLinkage,
  key: string,
  options?: { includeOwnAssign?: boolean }
): boolean {
  if (!linkage.rules) {
    return false;
  }

  const includeOwnAssign = options?.includeOwnAssign === true;

  return linkage.rules.some(rule => {
    const triggerCondition = getTriggerCondition(rule.trigger);

    if (triggerCondition !== undefined && conditionHasDateLiterals(triggerCondition, key)) {
      return true;
    }

    return rule.actions.some(action => actionHasDateLiterals(action, key, includeOwnAssign));
  });
}

export function hasScopedDateLiterals(
  layer: PresentationLayer,
  scope: ScopePath,
  targetFieldId: string,
  key: string
): boolean {
  let found = false;

  walkNodes(layer, (node, nodeScope) => {
    if (found || node.linkage === undefined || !scopeEquals(nodeScope, scope)) {
      return;
    }

    if (hasLinkageDateLiterals(node.linkage, key, { includeOwnAssign: node.id === targetFieldId })) {
      found = true;
    }
  });

  return found;
}

function scrubConditionDateLiterals(
  condition: LinkageCondition,
  target: DateGranularityScrubTarget
): LinkageCondition {
  switch (condition.kind) {
    case "leaf": {
      if (
        !isTargetDateConditionLeaf(condition, target.key)
        || isDateLiteralCompatible(target.fieldType, condition.value, target.nextGranularity, condition.operator)
      ) {
        return condition;
      }

      return { ...condition, value: "" };
    }

    case "group": {
      const children = mapPreservingIdentity(
        condition.children,
        child => scrubConditionDateLiterals(child, target)
      );

      return children === condition.children ? condition : { ...condition, children };
    }

    case "expression": {
      return condition;
    }

    default: {
      return assertNever(condition);
    }
  }
}

function scrubActionDateLiterals(
  action: FieldLinkageAction,
  target: DateGranularityScrubTarget,
  includeOwnAssign: boolean
): FieldLinkageAction {
  let next = mapActionDynamicValues(action, (value, meta) => {
    if (
      matchesDateTargetSlot(meta.targetKey, target.key, includeOwnAssign)
      && value.kind === "literal"
      && !isDateLiteralCompatible(target.fieldType, value.value, target.nextGranularity)
    ) {
      return { kind: "literal", value: "" };
    }

    return value;
  });

  next = mapActionConditions(next, condition => scrubConditionDateLiterals(condition, target)) ?? next;

  return next;
}

function scrubRuleDateLiterals(
  rule: FieldLinkageRule,
  target: DateGranularityScrubTarget,
  includeOwnAssign: boolean
): FieldLinkageRule {
  const trigger = mapTriggerCondition(rule.trigger, condition => scrubConditionDateLiterals(condition, target)) ?? rule.trigger;
  const actions = mapPreservingIdentity(
    rule.actions,
    action => scrubActionDateLiterals(action, target, includeOwnAssign)
  );

  return trigger === rule.trigger && actions === rule.actions
    ? rule
    : {
        ...rule,
        trigger,
        actions
      };
}

export function scrubLinkageDateLiterals(
  linkage: FieldLinkage,
  target: DateGranularityScrubTarget,
  options?: { includeOwnAssign?: boolean }
): FieldLinkage {
  if (!linkage.rules) {
    return linkage;
  }

  const includeOwnAssign = options?.includeOwnAssign === true;
  const rules = mapPreservingIdentity(
    linkage.rules,
    rule => scrubRuleDateLiterals(rule, target, includeOwnAssign)
  );

  return rules === linkage.rules ? linkage : { ...linkage, rules };
}

export function scrubDateLiterals(
  layer: PresentationLayer,
  scope: ScopePath,
  targetFieldId: string,
  target: DateGranularityScrubTarget
): PresentationLayer {
  return reconcileLayer(layer, (node, nodeScope) => {
    if (node.linkage === undefined || !scopeEquals(nodeScope, scope)) {
      return node;
    }

    const linkage = scrubLinkageDateLiterals(node.linkage, target, {
      includeOwnAssign: node.id === targetFieldId
    });

    return linkage === node.linkage ? node : { ...node, linkage };
  });
}
