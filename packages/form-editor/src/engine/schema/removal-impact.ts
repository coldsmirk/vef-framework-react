import type {
  Block,
  FieldLinkage,
  FieldLinkageRule,
  FieldOptionSource,
  FormDataSource,
  FormField,
  PresentationLayer
} from "../../types";
import type { ScopeKeyBucket } from "../keys";

import { collectBlocksKeysByScope, collectSubtreeKeysByScope } from "../keys";
import { getActionDynamicValues, getActionTargetKeys } from "../linkage/action-descriptors";
import { leafSourceFormKey } from "../linkage/scope";
import { hasConditionTriggeredShow } from "../linkage/shape";
import { isRecord } from "../validation";
import { removeBlock, updateNode } from "./mutate";
import { pruneDataSourcesKeyReferences, pruneFormLinkageForRootBucket, pruneScopedReferences } from "./reconcile";
import { findNode, findScope, isLeafField, isRootScope, nodeLabel, walkNodes } from "./walk";

export interface RemovalImpactOwner {
  ownerId: string;
  ownerLabel: string;
  /**
   * Number of affected items (removed rules, removed write assignments, or
   * cleared references) owned by this surviving block.
   */
  count: number;
}

export interface RemovalImpactField {
  id: string;
  label: string;
}

export interface RemovalImpact {
  /**
   * Rules on blocks OUTSIDE the removed subtree that the prune will drop.
   */
  removedRules: RemovalImpactOwner[];
  /**
   * Surviving owners that lose `set_fields` write assignments while the
   * enclosing rule survives.
   */
  removedAssignments: RemovalImpactOwner[];
  /**
   * Surviving owners whose dynamic-value references (in surviving rules or
   * inline remote option sources) will be cleared to empty.
   */
  clearedReferences: RemovalImpactOwner[];
  /**
   * Surviving fields the removal leaves default-hidden with no `show` rule —
   * permanently invisible at runtime.
   */
  unreachable: RemovalImpactField[];
  /**
   * Form-level (pc root scope) rules the prune will drop.
   */
  formRulesRemoved: number;
  /**
   * Form-level (pc root scope) surviving rules' dropped `set_fields` write items.
   */
  formAssignmentsRemoved: number;
  /**
   * Form-level (pc root scope) surviving rules' cleared reference slots.
   */
  formReferencesCleared: number;
  /**
   * Form-global remote data sources whose bound reference parameters will be
   * cleared when PC root-scope keys are removed.
   */
  clearedDataSourceReferences: RemovalImpactField[];
}

export function hasRemovalImpact(impact: RemovalImpact): boolean {
  return impact.removedRules.length > 0
    || impact.removedAssignments.length > 0
    || impact.clearedReferences.length > 0
    || impact.unreachable.length > 0
    || impact.formRulesRemoved > 0
    || impact.formAssignmentsRemoved > 0
    || impact.formReferencesCleared > 0
    || impact.clearedDataSourceReferences.length > 0;
}

const EMPTY_IMPACT: RemovalImpact = {
  removedRules: [],
  removedAssignments: [],
  clearedReferences: [],
  unreachable: [],
  formRulesRemoved: 0,
  formAssignmentsRemoved: 0,
  formReferencesCleared: 0,
  clearedDataSourceReferences: []
};

/**
 * What deleting `nodeId` (and its subtree) does to the REST of the schema —
 * computed by simulating the exact removal + reference-prune pipeline the
 * store runs, then diffing the before/after trees. Pure, so the editor can
 * show a truthful confirmation before committing the destructive action.
 *
 * `formLinkage` and `dataSources` resolve against the PC root scope only; pass
 * them when the removal happens on the PC presentation.
 */
export function collectRemovalImpact(
  layer: PresentationLayer,
  nodeId: string,
  formLinkage?: FieldLinkage,
  dataSources?: readonly FormDataSource[]
): RemovalImpact {
  const node = findNode(layer, nodeId);

  if (!node) {
    return EMPTY_IMPACT;
  }

  const baseScope = findScope(layer, nodeId) ?? [];
  const buckets = collectSubtreeKeysByScope(node, baseScope);

  // The same composite removal-prune the store commits, so this preview can
  // never drift from the real delete: drop the subtree, then prune references.
  return compareRemoval(
    layer,
    pruneScopedReferences(removeBlock(layer, nodeId), buckets),
    buckets,
    formLinkage,
    dataSources
  );
}

/**
 * What deleting one TAB of a tabs container does to the rest of the schema.
 *
 * A tab carries a whole body of fields, so removing one is as destructive as
 * removing a container — but it is not a node removal, and routing it through a
 * plain block update would skip the reference prune entirely: surviving rules
 * would keep pointing at keys that no longer exist, and the freed key would
 * later be handed to an unrelated new field, silently rebinding those rules to
 * it. Tabs never open a value scope, so the body's keys live in the tabs node's
 * own scope.
 */
export function collectTabRemovalImpact(
  layer: PresentationLayer,
  tabsId: string,
  tabId: string,
  formLinkage?: FieldLinkage,
  dataSources?: readonly FormDataSource[]
): RemovalImpact {
  const removal = removeTabBody(layer, tabsId, tabId);

  if (!removal) {
    return EMPTY_IMPACT;
  }

  return compareRemoval(
    layer,
    pruneScopedReferences(removal.layer, removal.buckets),
    removal.buckets,
    formLinkage,
    dataSources
  );
}

/**
 * Drop one tab from a tabs container, returning the resulting layer and the
 * keys that died with the body — `undefined` when the tab (or its container)
 * does not resolve, or when it is the last tab (a tabs container always keeps
 * at least one).
 */
export function removeTabBody(
  layer: PresentationLayer,
  tabsId: string,
  tabId: string
): { layer: PresentationLayer; buckets: ScopeKeyBucket[] } | undefined {
  const node = findNode(layer, tabsId);

  if (node?.type !== "tabs" || node.tabs.length <= 1) {
    return undefined;
  }

  const tab = node.tabs.find(candidate => candidate.id === tabId);

  if (!tab) {
    return undefined;
  }

  return {
    layer: updateNode(layer, tabsId, current => current.type === "tabs"
      ? { ...current, tabs: current.tabs.filter(candidate => candidate.id !== tabId) }
      : current),
    buckets: collectBlocksKeysByScope(tab.children, findScope(layer, tabsId) ?? [])
  };
}

function isRemovedReference(value: unknown, removedKeys: ReadonlySet<string>): boolean {
  if (!isRecord(value) || value.kind !== "reference" || typeof value.path !== "string") {
    return false;
  }

  const key = leafSourceFormKey(value.path);

  return key !== undefined && removedKeys.has(key);
}

function countClearedOptionSourceReferences(
  source: FieldOptionSource | undefined,
  removedKeys: ReadonlySet<string>
): number {
  if (source?.kind !== "remote" || source.request.params === undefined) {
    return 0;
  }

  let cleared = 0;

  for (const value of Object.values(source.request.params)) {
    if (isRemovedReference(value, removedKeys)) {
      cleared += 1;
    }
  }

  return cleared;
}

function countClearedNodeOptionSourceReferences(node: Block, removedKeys: ReadonlySet<string>): number {
  if (isLeafField(node)) {
    const field = node as FormField & { dataSource?: FieldOptionSource };

    return countClearedOptionSourceReferences(field.dataSource, removedKeys);
  }

  if (node.type === "subform" && node.rows?.mode === "fixed") {
    return countClearedOptionSourceReferences(node.rows.source, removedKeys);
  }

  return 0;
}

/**
 * Count the write items removed and the dynamic-value references cleared inside
 * one SURVIVING rule. Rules dropped wholesale are already reported under
 * `removedRules` / `formRulesRemoved` and are not double-counted here, nor is a
 * reference that goes away with its removed write item.
 */
function countSurvivingRuleImpacts(
  rule: FieldLinkageRule,
  removedKeys: ReadonlySet<string>
): { assignmentsRemoved: number; referencesCleared: number } {
  let assignmentsRemoved = 0;
  let referencesCleared = 0;

  for (const action of rule.actions) {
    for (const slot of getActionTargetKeys(action)) {
      if (typeof slot.targetKey === "string" && removedKeys.has(slot.targetKey)) {
        assignmentsRemoved += 1;
      }
    }

    for (const slot of getActionDynamicValues(action)) {
      const itemRemoved = slot.target?.kind === "field" && removedKeys.has(slot.target.key);

      if (!itemRemoved && isRemovedReference(slot.value, removedKeys)) {
        referencesCleared += 1;
      }
    }
  }

  return { assignmentsRemoved, referencesCleared };
}

/**
 * Diff a before/after tree pair into the impact the designer is shown. Shared
 * by every removal shape so a new one cannot describe its consequences
 * differently from the existing ones.
 */
function compareRemoval(
  layer: PresentationLayer,
  after: PresentationLayer,
  buckets: ScopeKeyBucket[],
  formLinkage: FieldLinkage | undefined,
  dataSources: readonly FormDataSource[] | undefined
): RemovalImpact {
  const keysByScope = new Map<string, ReadonlySet<string>>();

  for (const bucket of buckets) {
    keysByScope.set(bucket.scope.join("/"), bucket.keys);
  }

  const beforeNodes = collectNodesWithScope(layer);
  const afterRules = collectRulesByOwner(after);
  const removedRules: RemovalImpactOwner[] = [];
  const removedAssignments: RemovalImpactOwner[] = [];
  const clearedReferences: RemovalImpactOwner[] = [];

  for (const [ownerId, info] of beforeNodes) {
    if (findNode(after, ownerId) === undefined) {
      // The owner died with the subtree — its rules and refs are part of the
      // removal itself, not collateral the designer needs a warning about.
      continue;
    }

    const removedKeys = keysByScope.get(info.scopeId);

    if (removedKeys === undefined || removedKeys.size === 0) {
      continue;
    }

    const rules = info.node.linkage?.rules ?? [];
    // An owner whose every rule was pruned no longer appears in the after
    // map at all, so missing means "all lost", not "untouched".
    const survivorIds = afterRules.get(ownerId)?.ruleIds ?? new Set<string>();
    let lostRules = 0;
    let lostAssignments = 0;
    let lostReferences = countClearedNodeOptionSourceReferences(info.node, removedKeys);

    for (const rule of rules) {
      if (survivorIds.has(rule.id)) {
        const partial = countSurvivingRuleImpacts(rule, removedKeys);

        lostAssignments += partial.assignmentsRemoved;
        lostReferences += partial.referencesCleared;
      } else {
        lostRules += 1;
      }
    }

    if (lostRules > 0) {
      removedRules.push({
        ownerId,
        ownerLabel: info.label,
        count: lostRules
      });
    }

    if (lostAssignments > 0) {
      removedAssignments.push({
        ownerId,
        ownerLabel: info.label,
        count: lostAssignments
      });
    }

    if (lostReferences > 0) {
      clearedReferences.push({
        ownerId,
        ownerLabel: info.label,
        count: lostReferences
      });
    }
  }

  const previouslyUnreachable = new Set(collectUnreachableHidden(layer).map(field => field.id));
  const unreachable = collectUnreachableHidden(after).filter(field => !previouslyUnreachable.has(field.id));

  let formRulesRemoved = 0;
  let formAssignmentsRemoved = 0;
  let formReferencesCleared = 0;
  const rootBucket = buckets.find(bucket => isRootScope(bucket.scope));

  if (formLinkage?.rules !== undefined && rootBucket !== undefined && rootBucket.keys.size > 0) {
    const pruned = pruneFormLinkageForRootBucket(formLinkage, buckets);
    const survivorIds = new Set((pruned.rules ?? []).map(rule => rule.id));

    for (const rule of formLinkage.rules) {
      if (!survivorIds.has(rule.id)) {
        formRulesRemoved += 1;
        continue;
      }

      const partial = countSurvivingRuleImpacts(rule, rootBucket.keys);

      formAssignmentsRemoved += partial.assignmentsRemoved;
      formReferencesCleared += partial.referencesCleared;
    }
  }

  const clearedDataSourceReferences: RemovalImpactField[] = [];

  if (dataSources !== undefined && dataSources.length > 0 && rootBucket !== undefined && rootBucket.keys.size > 0) {
    const prunedSources = pruneDataSourcesKeyReferences([...dataSources], buckets);

    if (prunedSources !== undefined) {
      for (const [index, source] of dataSources.entries()) {
        if (prunedSources[index] !== source) {
          clearedDataSourceReferences.push({
            id: source.id,
            label: source.name.trim().length > 0 ? source.name.trim() : source.id
          });
        }
      }
    }
  }

  return {
    removedRules,
    removedAssignments,
    clearedReferences,
    unreachable,
    formRulesRemoved,
    formAssignmentsRemoved,
    formReferencesCleared,
    clearedDataSourceReferences
  };
}

function collectNodesWithScope(
  layer: PresentationLayer
): Map<string, { label: string; node: Block; scopeId: string }> {
  const nodes = new Map<string, { label: string; node: Block; scopeId: string }>();

  walkNodes(layer, (node, scope) => {
    nodes.set(node.id, {
      label: nodeLabel(node) ?? node.id,
      node,
      scopeId: scope.join("/")
    });
  });

  return nodes;
}

function collectRulesByOwner(layer: PresentationLayer): Map<string, { label: string; ruleIds: Set<string> }> {
  const owners = new Map<string, { label: string; ruleIds: Set<string> }>();

  walkNodes(layer, node => {
    const rules = node.linkage?.rules;

    if (rules === undefined || rules.length === 0) {
      return;
    }

    owners.set(node.id, {
      label: nodeLabel(node) ?? node.id,
      ruleIds: new Set(rules.map(rule => rule.id))
    });
  });

  return owners;
}

/**
 * Typed editor-side counterpart of the validator's
 * `default_hidden_unreachable` check: a block that starts hidden can only
 * become visible through one of its OWN rules carrying a `show` action (state
 * actions are self-targeted), so default-hidden with no such rule means the
 * block never appears.
 */
function collectUnreachableHidden(layer: PresentationLayer): RemovalImpactField[] {
  const fields: RemovalImpactField[] = [];

  walkNodes(layer, node => {
    if (node.linkage?.defaults?.hidden !== true) {
      return;
    }

    if (!hasConditionTriggeredShow(node.linkage.rules)) {
      fields.push({ id: node.id, label: nodeLabel(node) ?? node.id });
    }
  });

  return fields;
}
