import type {
  ConditionRetrigger,
  EffectAction,
  EvaluationContext,
  FieldLinkageRule,
  LinkageCondition,
  LinkageEvaluators,
  LinkageTriggerKind,
  RuntimeSchema
} from "../../types";

import { isRootScope, walkNodes } from "../schema/walk";
import { matchCondition } from "./evaluator";
import { ruleActions, ruleCondition, ruleConditionRetrigger, ruleTriggerKind, ruleWhen } from "./shape";
import { describeConditionSources } from "./source-tracking";
import { isEffectAction, isFieldEventTriggerKind } from "./taxonomy";

/**
 * The side-effect lane (pure half).
 *
 * Effect actions run sequentially per rule on a *trigger edge*, never on the
 * continuous state fold. The two edge sources are:
 *
 * - **Condition trigger** — a `condition`-triggered rule whose effect sequence
 * runs on false→true rising edge (or whenever tracked sources change while
 * holding when `trigger.retrigger === "always"`).
 * - **Event trigger** — a field event (`change` / `commit` / `focus` / `blur` /
 * `click`) or form lifecycle moment (`load` / `beforeSubmit` / `afterSubmit`),
 * optionally guarded by `trigger.when`.
 *
 * Everything here is pure; sequence control, action execution, and React wiring
 * live under `runtime/`.
 */

/**
 * A `condition`-triggered rule that carries at least one effect action, reduced
 * to just the pieces the edge tracker and sequence controller need.
 */
export interface ConditionEffectRule {
  ruleId: string;
  /**
   * Owning block id for field-scoped rules (used to drive busy indicators on
   * that field); `undefined` for form-scoped rules (`schema.linkage`).
   */
  ownerId?: string;
  condition: LinkageCondition;
  /**
   * Rule-level retrigger policy (`"edge"` by default, or `"always"`).
   */
  retrigger: ConditionRetrigger;
  /**
   * The FORM-VALUE fields this condition reads. The `"always"` tracker diffs
   * these between evaluations so an unrelated field change does not re-fire
   * this rule. Empty is a real answer — a condition on a `$`-rooted context
   * path depends on nothing in the form — and must not be confused with
   * {@link opaque}.
   */
  sourceKeys: string[];
  /**
   * Whether the condition reads inputs that cannot be enumerated (an
   * `expression` condition). Only then does the tracker fall back to diffing
   * the whole values object.
   */
  opaque: boolean;
  /**
   * The rule's effect actions, in declaration order. State actions (if any)
   * are excluded; they are handled by the state lane.
   */
  actions: EffectAction[];
}

/**
 * One event-triggered rule's effect sequence (keeping rule identity for
 * single-flight cancellation and its optional `when` guard).
 */
export interface TriggerEffectSequence {
  ruleId: string;
  when?: LinkageCondition;
  actions: EffectAction[];
}

/**
 * Gather, for one value scope, every `condition`-triggered rule that carries
 * effect actions. Mirrors `evaluateRuntimeStates`' scoping: it walks only the
 * root-scope nodes of `schema` (a subform template is passed as its own schema
 * by the per-row controller), skipping deeper subform scopes.
 *
 * Memoize the result by `schema` — it is schema-stable, so the runtime computes
 * it once per scope rather than per value change.
 */
export function collectConditionEffectRules(schema: RuntimeSchema): ConditionEffectRule[] {
  const result: ConditionEffectRule[] = [];

  // Form-scope condition rules evaluate against the root values, exactly like a
  // root-scope field rule, so they join the root scope's edge tracking. A
  // subform template is passed as its own schema (no `linkage`), so this is a
  // no-op there.
  pushConditionEffectRules(schema.linkage?.rules, undefined, result);

  walkNodes(schema, (node, scope) => {
    if (!isRootScope(scope)) {
      return;
    }

    pushConditionEffectRules(node.linkage?.rules, node.id, result);
  });

  return result;
}

function pushConditionEffectRules(
  rules: FieldLinkageRule[] | undefined,
  ownerId: string | undefined,
  out: ConditionEffectRule[]
): void {
  const linkageRules = Array.isArray(rules) ? rules : [];

  for (const [index, rule] of linkageRules.entries()) {
    const condition = ruleCondition(rule);

    if (condition === undefined) {
      continue;
    }

    const actions = ruleActions(rule).filter(action => isEffectAction(action));

    if (actions.length > 0) {
      const sources = describeConditionSources(condition);
      const ruleId = typeof rule.id === "string" && rule.id.length > 0 ? rule.id : `${ownerId ?? "form"}#${index}`;

      out.push({
        ruleId,
        ...ownerId !== undefined && { ownerId },
        condition,
        retrigger: ruleConditionRetrigger(rule),
        sourceKeys: sources.keys,
        opaque: sources.opaque,
        actions
      });
    }
  }
}

/**
 * Evaluate the current truth of each condition-effect rule, positionally
 * aligned with {@link collectConditionEffectRules}'s output, so the runtime can
 * diff against the previous vector to detect rising edges.
 */
export function evaluateConditionEffectTruths(
  rules: ConditionEffectRule[],
  values: Record<string, unknown>,
  evaluators: Required<LinkageEvaluators>,
  context?: EvaluationContext
): boolean[] {
  return rules.map(rule => matchCondition(rule.condition, values, evaluators, context));
}

/**
 * The per-rule effect sequences to run when an edge trigger fires. Preserves
 * each rule's `id` (single-flight identity) and optional `when` guard rather
 * than flattening actions across rules. Used for both field events (`change` /
 * `commit` / `focus` / `blur` / `click`) and form lifecycle moments (`load` /
 * `beforeSubmit` / `afterSubmit`).
 */
export function getTriggerEffectSequences(
  rules: FieldLinkageRule[] | undefined,
  kind: LinkageTriggerKind
): TriggerEffectSequence[] {
  if (!Array.isArray(rules)) {
    return [];
  }

  const sequences: TriggerEffectSequence[] = [];

  for (const [index, rule] of rules.entries()) {
    if (ruleTriggerKind(rule) !== kind) {
      continue;
    }

    const actions = ruleActions(rule).filter(action => isEffectAction(action));

    if (actions.length === 0) {
      continue;
    }

    const when = ruleWhen(rule);
    const ruleId = typeof rule.id === "string" && rule.id.length > 0 ? rule.id : `${kind}#${index}`;

    sequences.push({
      ruleId,
      ...when !== undefined && { when },
      actions
    });
  }

  return sequences;
}

/**
 * The set of field-event edge kinds (`change` / `commit` / `focus` / `blur` /
 * `click`) a field listens for — drives which DOM handlers the renderer
 * attaches, so a field with no event rules pays nothing.
 */
export function getFieldEventTriggerKinds(
  rules: FieldLinkageRule[] | undefined
): Set<LinkageTriggerKind> {
  const kinds = new Set<LinkageTriggerKind>();
  const linkageRules = Array.isArray(rules) ? rules : [];

  for (const rule of linkageRules) {
    const kind = ruleTriggerKind(rule);

    if (kind !== undefined && isFieldEventTriggerKind(kind) && ruleActions(rule).some(action => isEffectAction(action))) {
      kinds.add(kind);
    }
  }

  return kinds;
}
