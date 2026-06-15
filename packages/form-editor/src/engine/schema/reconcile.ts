import type {
  Block,
  FieldLinkage,
  FieldLinkageAction,
  FieldLinkageRule,
  FieldOptionSource,
  FormField,
  FormSchema,
  LinkageCondition,
  PresentationLayer
} from "../../types";
import type { ScopeKeyBucket } from "../keys";
import type { ScopePath } from "./walk";

import { assertNever } from "../assert-never";
import { bodyScopeKey, mapPreservingIdentity } from "./nodes";
import { rewriteContainerBodies } from "./rewrite";
import { isContainerNode, isLeafField, isRootScope, scopeEquals } from "./walk";

/**
 * Reference-consistency reconciliation. Structural edits (remove / rename) and
 * declaration edits (variables / data sources) can leave the rest of the schema
 * pointing at things that no longer exist; the functions here rewrite or prune
 * those references so the editor never emits a schema with dangling links.
 *
 * Scope model:
 *
 * - **Keys are per value scope.** A node's linkage resolves `leaf.sourceKey` /
 * `set_field.targetKey` against the node's *own* enclosing scope, so the
 * key-level functions take the affected {@link ScopePath} and rewrite only
 * nodes sitting in exactly that scope — a same-named key in an outer scope or
 * another subform template is a different binding and stays untouched.
 * - **Variables and data sources are form-global.** Their functions rewrite
 * every node across **both** presentations plus the form-level
 * `schema.linkage`, with no scope filter.
 * - **The form-level `schema.linkage` resolves against the PC root scope.**
 * The layer-level key functions cannot see it, so the store reconciles it via
 * the exported linkage-level helpers whenever a *pc root-scope* key is renamed
 * or removed; mobile-layer key changes never touch it.
 *
 * Identity contract (shared with `mutate.ts` / `edit-ops.ts`): a call that
 * changes nothing returns the **input reference unchanged**, and a change
 * rebuilds only the path to it — untouched nodes, rules, and block lists keep
 * their references, so the store detects no-ops with `===` and the canvas
 * memoization stays intact.
 */

/* ----------------------------------------------------------- tree plumbing */

/**
 * Per-node rewrite applied by {@link reconcileLayer}. Receives each node with
 * its enclosing {@link ScopePath}; returns the node unchanged to skip it.
 */
type NodePatch = (node: Block, scope: ScopePath) => Block;

function reconcileBlocks(blocks: Block[], scope: ScopePath, patch: NodePatch): Block[] {
  let changed = false;
  const next = blocks.map(block => {
    const rewritten = reconcileBlock(block, scope, patch);

    if (rewritten !== block) {
      changed = true;
    }

    return rewritten;
  });

  return changed ? next : blocks;
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

/* ------------------------------------------------------------- key renames */

function renameConditionKeys(condition: LinkageCondition, oldKey: string, newKey: string): LinkageCondition {
  switch (condition.kind) {
    case "leaf": {
      return condition.sourceKey === oldKey ? { ...condition, sourceKey: newKey } : condition;
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

function renameRuleKeys(rule: FieldLinkageRule, oldKey: string, newKey: string): FieldLinkageRule {
  let { trigger } = rule;

  if (trigger.kind === "condition") {
    const condition = renameConditionKeys(trigger.condition, oldKey, newKey);

    if (condition !== trigger.condition) {
      trigger = { ...trigger, condition };
    }
  }

  const actions = mapPreservingIdentity(rule.actions, action => action.type === "set_field" && action.targetKey === oldKey ? { ...action, targetKey: newKey } : action);

  return trigger === rule.trigger && actions === rule.actions
    ? rule
    : {
        ...rule,
        trigger,
        actions
      };
}

/**
 * Rewrite every `leaf.sourceKey` / `set_field.targetKey` reference to `oldKey`
 * inside one linkage payload. Scope-blind by design: the caller decides which
 * linkage resolves in the affected scope — the layer-level
 * {@link renameKeyReferences} filters per node, and the store applies this
 * directly to the form-level `schema.linkage` when a pc root-scope key is
 * renamed.
 */
export function renameLinkageKeyReferences(linkage: FieldLinkage, oldKey: string, newKey: string): FieldLinkage {
  if (!linkage.rules) {
    return linkage;
  }

  const rules = mapPreservingIdentity(linkage.rules, rule => renameRuleKeys(rule, oldKey, newKey));

  return rules === linkage.rules ? linkage : { ...linkage, rules };
}

/**
 * Rewrite condition `sourceKey`s and `set_field.targetKey`s from `oldKey` to
 * `newKey` across the layer, for the nodes whose linkage resolves in exactly
 * `scope`. Subform templates open their own scope, so a same-named key inside
 * (or outside) them is a different binding and is left untouched.
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
    if (node.linkage === undefined || !scopeEquals(nodeScope, scope)) {
      return node;
    }

    const linkage = renameLinkageKeyReferences(node.linkage, oldKey, newKey);

    return linkage === node.linkage ? node : { ...node, linkage };
  });
}

/* -------------------------------------------------------------- key prunes */

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
      return removedKeys.has(condition.sourceKey) ? undefined : condition;
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

/**
 * Prune one rule: a `condition` trigger whose condition is gone removes the
 * rule; `set_field` actions targeting a removed key are dropped, and a rule
 * emptied of actions *by that drop* is removed.
 */
function pruneRuleKeys(rule: FieldLinkageRule, removedKeys: ReadonlySet<string>): FieldLinkageRule | undefined {
  let { trigger } = rule;

  if (trigger.kind === "condition") {
    const condition = pruneCondition(trigger.condition, removedKeys);

    if (condition === undefined) {
      return undefined;
    }

    if (condition !== trigger.condition) {
      trigger = { ...trigger, condition };
    }
  }

  const actions: FieldLinkageAction[] = [];
  let actionsChanged = false;

  for (const action of rule.actions) {
    if (action.type === "set_field" && removedKeys.has(action.targetKey)) {
      actionsChanged = true;
      continue;
    }

    actions.push(action);
  }

  if (trigger === rule.trigger && !actionsChanged) {
    return rule;
  }

  if (actionsChanged && actions.length === 0) {
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
 * bottom-up: leaf → enclosing group → rule, and action → rule. Scope-blind by
 * design, mirroring {@link renameLinkageKeyReferences} — the store applies
 * this directly to the form-level `schema.linkage` when pc root-scope keys are
 * removed.
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
 * Drop every reference to the removed keys across the layer, for the nodes
 * whose linkage resolves in exactly `scope`: leaf conditions on a removed
 * `sourceKey` are pruned (cascading group → rule removal), and `set_field`
 * actions on a removed `targetKey` are dropped (a rule emptied of actions is
 * removed). Subform templates are separate key namespaces and are left
 * untouched unless `scope` names them.
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
    if (node.linkage === undefined || !scopeEquals(nodeScope, scope)) {
      return node;
    }

    const linkage = pruneLinkageKeyReferences(node.linkage, removedKeys);

    return linkage === node.linkage ? node : { ...node, linkage };
  });
}

/**
 * Prune layer-level linkage references to a set of removed keys, scope by scope.
 * The composite the store and the removal-impact preview share: a subtree
 * removal (or a cross-scope move's departure) collects its dying keys into
 * {@link ScopeKeyBucket}s, and this applies {@link pruneKeyReferences} once per
 * bucket. Identity-preserving — returns the input layer when nothing matched.
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

/* --------------------------------------------------------------- variables */

function renameLinkageVariableReferences(linkage: FieldLinkage, name: string, nextName: string): FieldLinkage {
  if (!linkage.rules) {
    return linkage;
  }

  const rules = mapPreservingIdentity(linkage.rules, rule => {
    const actions = mapPreservingIdentity(rule.actions, action => action.type === "set_variable" && action.variable === name ? { ...action, variable: nextName } : action);

    return actions === rule.actions ? rule : { ...rule, actions };
  });

  return rules === linkage.rules ? linkage : { ...linkage, rules };
}

/**
 * Rewrite every `set_variable` action targeting variable `name` to
 * `nextName`, across **both** presentations and the form-level
 * `schema.linkage`. Variables are form-global, so there is no scope filter.
 *
 * Identity contract: no action targeted `name` ⇒ the input schema reference is
 * returned.
 */
export function renameVariableReferences(schema: FormSchema, name: string, nextName: string): FormSchema {
  return reconcileFormLinkage(
    mapPresentations(schema, layer => reconcileLayer(layer, node => {
      if (node.linkage === undefined) {
        return node;
      }

      const linkage = renameLinkageVariableReferences(node.linkage, name, nextName);

      return linkage === node.linkage ? node : { ...node, linkage };
    })),
    linkage => renameLinkageVariableReferences(linkage, name, nextName)
  );
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
    if (action.type === "refresh_data_source" && action.dataSourceId === dataSourceId) {
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
 * becomes source-less), and `refresh_data_source` actions naming it are
 * dropped (a rule emptied of actions is removed) — across **both**
 * presentations and the form-level `schema.linkage`. Data sources are
 * form-global, so there is no scope filter. The declaration itself lives in
 * `schema.dataSources` and is the caller's to remove.
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
