import type { FieldLinkage, PresentationLayer } from "../../types";

import { collectSubtreeKeysByScope } from "../keys";
import { removeBlock } from "./mutate";
import { pruneFormLinkageForRootBucket, pruneScopedReferences } from "./reconcile";
import { findNode, findScope, nodeLabel, walkNodes } from "./walk";

export interface RemovalImpactOwner {
  ownerId: string;
  ownerLabel: string;
  /**
   * Rules this surviving owner loses to the reference prune.
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
   * Surviving fields the removal leaves default-hidden with no `show` rule —
   * permanently invisible at runtime.
   */
  unreachable: RemovalImpactField[];
  /**
   * Form-level (pc root scope) rules the prune will drop.
   */
  formRulesRemoved: number;
}

export function hasRemovalImpact(impact: RemovalImpact): boolean {
  return impact.removedRules.length > 0 || impact.unreachable.length > 0 || impact.formRulesRemoved > 0;
}

const EMPTY_IMPACT: RemovalImpact = {
  removedRules: [],
  unreachable: [],
  formRulesRemoved: 0
};

/**
 * What deleting `nodeId` (and its subtree) does to the REST of the schema —
 * computed by simulating the exact removal + reference-prune pipeline the
 * store runs, then diffing the before/after trees. Pure, so the editor can
 * show a truthful confirmation before committing the destructive action.
 *
 * `formLinkage` is the form-level linkage to consider; pass it only when the
 * removal happens on the presentation it resolves against (the pc layer).
 */
export function collectRemovalImpact(layer: PresentationLayer, nodeId: string, formLinkage?: FieldLinkage): RemovalImpact {
  const node = findNode(layer, nodeId);

  if (!node) {
    return EMPTY_IMPACT;
  }

  const baseScope = findScope(layer, nodeId) ?? [];
  const buckets = collectSubtreeKeysByScope(node, baseScope);

  // The same composite removal-prune the store commits, so this preview can
  // never drift from the real delete: drop the subtree, then prune references.
  const after = pruneScopedReferences(removeBlock(layer, nodeId), buckets);

  const beforeRules = collectRulesByOwner(layer);
  const afterRules = collectRulesByOwner(after);
  const removedRules: RemovalImpactOwner[] = [];

  for (const [ownerId, info] of beforeRules) {
    if (findNode(after, ownerId) === undefined) {
      // The owner died with the subtree — its rules are part of the removal
      // itself, not collateral the designer needs a warning about.
      continue;
    }

    // An owner whose every rule was pruned no longer appears in the after
    // map at all, so missing means "all lost", not "untouched".
    const survivorIds = afterRules.get(ownerId)?.ruleIds ?? new Set<string>();
    const lost = [...info.ruleIds].filter(ruleId => !survivorIds.has(ruleId)).length;

    if (lost > 0) {
      removedRules.push({
        ownerId,
        ownerLabel: info.label,
        count: lost
      });
    }
  }

  const previouslyUnreachable = new Set(collectUnreachableHidden(layer).map(field => field.id));
  const unreachable = collectUnreachableHidden(after).filter(field => !previouslyUnreachable.has(field.id));

  let formRulesRemoved = 0;

  if (formLinkage?.rules !== undefined) {
    const pruned = pruneFormLinkageForRootBucket(formLinkage, buckets);
    formRulesRemoved = formLinkage.rules.length - (pruned.rules?.length ?? 0);
  }

  return {
    removedRules,
    unreachable,
    formRulesRemoved
  };
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

    const hasShow = node.linkage.rules?.some(rule => rule.actions.some(action => action.type === "show")) ?? false;

    if (!hasShow) {
      fields.push({ id: node.id, label: nodeLabel(node) ?? node.id });
    }
  });

  return fields;
}
