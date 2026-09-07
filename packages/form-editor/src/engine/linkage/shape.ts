import type { FieldLinkage, FieldLinkageAction, FieldLinkageRule, LinkageCondition, LinkageTriggerKind } from "../../types";

import { isRecord } from "../validation";

/**
 * Structural trust guards for host-supplied linkage.
 *
 * `FormRenderer` never calls `validateSchema` — the runtime schema is whatever
 * the host handed it, typically JSON parsed from storage. So every render-path
 * reader must treat a rule as unknown data and degrade to "skipped" rather than
 * throw: a malformed rule inside a nested container would otherwise take the
 * whole form down to a white screen, with a `TypeError` naming a React internal
 * rather than the offending schema.
 *
 * The validator lane has its own inline guards because it reports each fault as
 * an issue; these are the silent counterpart for the lane that has no reporting
 * channel. Keeping them here means a reader adds a call rather than an ad-hoc
 * `?.`, which is how the guards drifted apart in the first place.
 */

/**
 * A linkage block's rules, or an empty list when the block is absent or its
 * `rules` is not an array. A non-array `rules` (`{}` from a hand-edited or
 * half-migrated document) is the case a bare `?? []` misses: it is neither null
 * nor undefined, so it reaches `for…of` and throws "is not iterable".
 */
export function linkageRules(linkage: FieldLinkage | undefined): FieldLinkageRule[] {
  const rules = linkage?.rules;

  return Array.isArray(rules) ? rules : [];
}

/**
 * A rule's trigger kind, or `undefined` when the rule or its trigger is not a
 * record. Callers compare against the kind they want, so an unusable rule
 * simply never matches.
 */
export function ruleTriggerKind(rule: FieldLinkageRule): LinkageTriggerKind | undefined {
  if (!isRecord(rule) || !isRecord(rule.trigger)) {
    return undefined;
  }

  return rule.trigger.kind as LinkageTriggerKind | undefined;
}

/**
 * The condition of a `condition`-triggered rule, or `undefined` for any other
 * trigger kind and for a malformed rule. Callers that need both the kind check
 * and the payload use this alone: reading `rule.trigger.condition` back off the
 * rule after a {@link ruleTriggerKind} check re-enters the unguarded union and
 * loses the narrowing.
 */
export function ruleCondition(rule: FieldLinkageRule): LinkageCondition | undefined {
  if (!isRecord(rule) || !isRecord(rule.trigger) || rule.trigger.kind !== "condition") {
    return undefined;
  }

  return rule.trigger.condition as LinkageCondition | undefined;
}

/**
 * A rule's actions, or an empty list when the rule is malformed. Pairs with
 * {@link ruleTriggerKind}: a reader that filters by trigger still has to reach
 * into `actions`, and both halves must survive the same broken rule.
 */
export function ruleActions(rule: FieldLinkageRule): FieldLinkageAction[] {
  if (!isRecord(rule) || !Array.isArray(rule.actions)) {
    return [];
  }

  return rule.actions as FieldLinkageAction[];
}

/**
 * Whether any rule can ever lift a `defaults.hidden` block into view.
 *
 * Only a condition-triggered `show` counts: a `show` on an edge trigger is
 * separately rejected (`state_action_on_edge_trigger`) and never reaches the
 * state lane, so it must not be mistaken for a way out. Shared by the linkage
 * validator and the editor's removal-impact preview — the two describe the same
 * property to the user (one as a publish-time warning, one as a delete
 * confirmation), so they cannot be allowed to disagree.
 */
export function hasConditionTriggeredShow(rules: unknown): boolean {
  if (!Array.isArray(rules)) {
    return false;
  }

  return (rules as FieldLinkageRule[]).some(
    rule => ruleCondition(rule) !== undefined
      && ruleActions(rule).some(action => isRecord(action) && action.type === "show")
  );
}
