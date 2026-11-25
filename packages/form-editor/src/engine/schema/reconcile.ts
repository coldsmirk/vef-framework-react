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
  getActionDataSourceId,
  getActionDynamicValues,
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
 * Scope model:
 *
 * - **Keys are per value scope.** A node's linkage and inline remote option
 * source resolve form-key references (`leaf.sourceKey`, trigger `when`,
 * `set_fields` target keys, and `reference` dynamic values) against the node's
 * own enclosing scope, so the key-level and date-granularity functions take
 * the affected {@link ScopePath} and rewrite only nodes sitting in exactly that
 * scope — a same-named key in an outer scope or another subform template is a
 * different binding and stays untouched.
 * - **Variables and data sources are form-global.** Their functions rewrite
 * every node across **both** presentations, form-global `schema.dataSources`,
 * and the form-level `schema.linkage`, with no scope filter.
 * - **The form-level `schema.linkage` and remote `schema.dataSources` resolve
 * against the PC root scope.** The layer-level key functions cannot see them,
 * so the store reconciles them via the exported form-level helpers whenever a
 * pc root-scope key is renamed, removed, or switched to a new date
 * granularity; mobile-layer-only changes never touch them.
 *
 * Identity contract (shared with `mutate.ts` / `edit-ops.ts`): a call that
 * changes nothing returns the **input reference unchanged**, and a change
 * rebuilds only the path to it — untouched nodes, rules, and block lists keep
 * their references, so the store detects no-ops with `===` and the canvas
 * memoization stays intact.
 *
 * All action traversals route exclusively through the central action
 * descriptors (`engine/linkage/action-descriptors.ts`), and all trigger
 * condition/guard traversals through `getTriggerCondition` /
 * `mapTriggerCondition` (`engine/linkage/shape.ts`).
 */

/* ----------------------------------------------------------- tree plumbing */

/**
 * Per-node rewrite applied by {@link reconcileLayer}. Receives each node with
 * its enclosing {@link ScopePath}; returns the node unchanged to skip it.
 */
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

/**
 * Apply a scope-tracking {@link NodePatch} to every node of a layer with full
 * structural sharing.
 */
function reconcileLayer(layer: PresentationLayer, patch: NodePatch): PresentationLayer {
  const children = reconcileBlocks(layer.children, [], patch);

  return children === layer.children ? layer : { ...layer, children };
}

/**
 * Transform both device presentations through `transform`, preserving the
 * schema reference when neither layer changed.
 */
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

/**
 * Re-apply a per-linkage transform to the form-level `schema.linkage` (the PC
 * root-scope events), preserving the schema reference when the linkage is absent
 * or the transform changed nothing. The form-global reconcilers (variables /
 * data sources) pair this tail with a {@link mapPresentations} pass over the node
 * trees, so the shared "rewrite both presentations, then the form linkage" shape
 * lives in one place.
 */
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

/**
 * Rewrite every `DynamicValue` entry on a node's inline remote option source
 * (leaf `dataSource` or fixed-row subform `rows.source`), preserving identity
 * when nothing changed. Shared by reference reconciliation and clone/move key
 * remapping (`edit-ops.ts`).
 */
export function mapNodeOptionSourceDynamicValues(
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
  const next = mapActionTargetKeys(action, targetKey => targetKey === oldKey ? newKey : targetKey) ?? action;

  return mapActionDynamicValues(next, value => renameDynamicValueKey(value, oldKey, newKey));
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
 * target keys, and `reference` dynamic values) from `oldKey` to `newKey` inside
 * one linkage payload. Scope-blind by design: the caller decides which linkage
 * resolves in the affected scope — the layer-level {@link renameKeyReferences}
 * filters per node, and {@link renameFormRootKeyReferences} applies this to the
 * form-level `schema.linkage` when a pc root-scope key is renamed.
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
 * Rewrite form-key references in linkage rules and inline remote option-source
 * params from `oldKey` to `newKey` across the layer, for the nodes whose scope
 * matches `scope` exactly. Subform templates open their own scope, so a
 * same-named key inside (or outside) them is a different binding and is left
 * untouched.
 *
 * Identity contract: no reference to `oldKey` in that scope ⇒ the input layer
 * reference is returned.
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

/**
 * Prune a condition against removed keys. Returns the input when untouched, a
 * rewritten condition when partially pruned, and `undefined` when the
 * condition itself is gone — a leaf on a removed key, or a group emptied *by
 * this prune* (a group that was already empty is authoring state, not a
 * dangling reference, and is kept).
 */
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

  return mapActionDynamicValues(afterTargets, value => pruneDynamicValueKeys(value, removedKeys));
}

/**
 * Prune one rule: a `condition` trigger whose condition is gone removes the
 * rule (an event trigger whose `when` guard empties drops the guard and keeps
 * the trigger); `set_fields` assignments targeting a removed key are dropped
 * (an action emptied of assignments is dropped, and a rule emptied of actions
 * by that drop is removed).
 */
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

/**
 * Drop every reference to the removed keys across the layer, for the nodes
 * whose scope matches `scope` exactly: leaf conditions on a removed `sourceKey`
 * are pruned (cascading group → rule removal), `set_fields` assignments on a
 * removed `targetKey` are dropped (cascading empty action → empty rule
 * removal), and dangling `reference` dynamic values on actions or inline remote
 * option sources are cleared to `path: ""`. Subform templates are separate key
 * namespaces and are left untouched unless `scope` names them.
 *
 * Identity contract: nothing referenced a removed key in that scope ⇒ the
 * input layer reference is returned.
 */
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

/**
 * Prune layer-level linkage and option-source references to a set of removed
 * keys, scope by scope. The composite the store and the removal-impact preview
 * share: a subtree removal (or a cross-scope move's departure) collects its
 * dying keys into {@link ScopeKeyBucket}s, and this applies
 * {@link pruneKeyReferences} once per bucket. Identity-preserving — returns the
 * input layer when nothing matched.
 */
export function pruneScopedReferences(layer: PresentationLayer, buckets: readonly ScopeKeyBucket[]): PresentationLayer {
  let next = layer;

  for (const bucket of buckets) {
    next = pruneKeyReferences(next, bucket.scope, bucket.keys);
  }

  return next;
}

/**
 * Prune the form-level linkage (the PC root scope) against the root bucket of a
 * removal — the keys that died at `scope === []`. Mobile / nested-scope buckets
 * never touch it. Identity-preserving: returns the input linkage when there is
 * no root bucket or nothing matched. Pairs with {@link pruneScopedReferences} so
 * every caller treats the form linkage's root-scope special case identically.
 */
export function pruneFormLinkageForRootBucket(linkage: FieldLinkage, buckets: readonly ScopeKeyBucket[]): FieldLinkage {
  const rootBucket = buckets.find(bucket => isRootScope(bucket.scope));

  return rootBucket ? pruneLinkageKeyReferences(linkage, rootBucket.keys) : linkage;
}

/**
 * Prune form-level references (`schema.linkage` and form-global remote
 * `schema.dataSources`) to removed PC root-scope keys. Identity-preserving when
 * nothing changes.
 */
export function pruneFormRootKeyReferences(schema: FormSchema, buckets: readonly ScopeKeyBucket[]): FormSchema {
  let next = reconcileFormLinkage(schema, linkage => pruneFormLinkageForRootBucket(linkage, buckets));

  if (next.dataSources !== undefined) {
    const dataSources = pruneDataSourcesKeyReferences(next.dataSources, buckets);

    if (dataSources !== next.dataSources && dataSources !== undefined) {
      next = { ...next, dataSources };
    }
  }

  return next;
}

/**
 * Rewrite form-level references (`schema.linkage` and form-global remote
 * `schema.dataSources`) when a PC root-scope key is renamed. Identity-preserving
 * when nothing changes.
 */
export function renameFormRootKeyReferences(schema: FormSchema, oldKey: string, newKey: string): FormSchema {
  let next = reconcileFormLinkage(schema, linkage => renameLinkageKeyReferences(linkage, oldKey, newKey));

  if (next.dataSources !== undefined) {
    const dataSources = renameDataSourcesKeyReferences(next.dataSources, oldKey, newKey);

    if (dataSources !== next.dataSources && dataSources !== undefined) {
      next = { ...next, dataSources };
    }
  }

  return next;
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
  const next = rewriteActionVariable(action, name, nextName);

  return mapActionDynamicValues(next, value => renameDynamicValueVariable(value, name, nextName));
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
 * and remote option sources) across **both** presentations, form-global
 * `dataSources`, and `schema.linkage`. Variables are form-global, so there is
 * no scope filter.
 *
 * Identity contract: nothing referenced `name` ⇒ the input schema reference is
 * returned.
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

/**
 * Drop a field's `dataSource` when it is a `ref` to the removed source. The
 * key is deleted (not set to `undefined`), leaving the field source-less —
 * inline `static` / `remote` sources are unrelated and kept. The structural
 * read mirrors `isKeyedNode`: only some field types declare the slot, so the
 * union is probed through a narrow auxiliary shape rather than widened.
 */
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

/**
 * Drop every reference to a removed form-global data source: field-level
 * `{ kind: "ref" }` option sources lose their `dataSource` key (the field
 * becomes source-less), fixed-row subforms reset their `ref` target, and
 * `refresh_data_source` actions naming it are dropped (a rule emptied of
 * actions is removed) — across **both** presentations and the form-level
 * `schema.linkage`. Data sources are form-global, so there is no scope filter.
 * The declaration itself lives in `schema.dataSources` and is the caller's to
 * remove.
 *
 * Identity contract: nothing referenced the source ⇒ the input schema
 * reference is returned.
 */
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

/**
 * Target of a date-granularity literal scrub: a `date` or `daterange` field
 * identified by its `key` and `fieldType`, switching to `nextGranularity`.
 */
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

  return false;
}

/**
 * Report whether one linkage payload carries any non-empty literal targeting
 * `key` (value-bearing leaf conditions / guards on `key`, `set_fields` literal
 * assignments targeting `key`, and — when `includeOwnAssign` is set — `assign`
 * literal actions). Shares its matching predicates with
 * {@link scrubLinkageDateLiterals} so the confirmation gate and the scrub stay
 * in lockstep.
 */
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

/**
 * Report whether any node in `scope` of `layer` carries an authored linkage
 * literal targeting `key` (including own `assign` literals on `targetFieldId`).
 */
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
  return mapActionDynamicValues(action, (value, meta) => {
    if (
      matchesDateTargetSlot(meta.targetKey, target.key, includeOwnAssign)
      && value.kind === "literal"
      && !isDateLiteralCompatible(target.fieldType, value.value, target.nextGranularity)
    ) {
      return { kind: "literal", value: "" };
    }

    return value;
  });
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

/**
 * Clear every literal inside one linkage payload that is incompatible with
 * `target.nextGranularity` — condition/guard leaves on `target.key`,
 * `set_fields` literal assignments targeting `target.key`, and (when
 * `includeOwnAssign` is set) own `assign` literal actions. Scope-blind by
 * design, mirroring {@link renameLinkageKeyReferences} and
 * {@link pruneLinkageKeyReferences}: the store applies this directly to the PC
 * root `schema.linkage` when affected.
 *
 * Identity contract: no incompatible literal ⇒ the input linkage reference is
 * returned.
 */
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

/**
 * Clear every linkage literal incompatible with `target.nextGranularity` across
 * the nodes of `layer` whose linkage resolves in exactly `scope` (including own
 * `assign` literals on `targetFieldId`). Subform templates open their own
 * scope, so a same-named key in another scope is left untouched.
 *
 * Identity contract: no incompatible literal in that scope ⇒ the input layer
 * reference is returned.
 */
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
