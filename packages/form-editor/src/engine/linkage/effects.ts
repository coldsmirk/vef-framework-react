import type {
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
import { collectConditionSourceKeys } from "./source-tracking";
import { isEffectAction, isFieldEventTriggerKind } from "./taxonomy";

/**
 * The side-effect lane (pure half).
 *
 * Effect actions fire on a *trigger edge*, never on the continuous state fold.
 * The two edge sources are:
 *
 * - **Condition rising edge** — a `condition`-triggered rule whose effect
 * actions run once when the condition transitions false→true. The runtime
 * tracks each rule's previous truth; this module supplies the rule inventory
 * ({@link collectConditionEffectRules}) and the per-evaluation truth vector
 * ({@link evaluateConditionEffectTruths}).
 * - **Field event** — a `change` / `focus` / `blur` / `click`-triggered rule
 * whose effect actions the renderer dispatches imperatively from the field's
 * own DOM events ({@link getTriggerEffectActions},
 * {@link getFieldEventTriggerKinds}).
 *
 * Everything here is pure; the form api, host `dispatchEffect`, and React wiring
 * live in `runtime/effects.tsx`.
 */

/**
 * A `condition`-triggered rule that carries at least one effect action, reduced
 * to just the pieces the edge tracker needs.
 */
export interface ConditionEffectRule {
  ruleId: string;
  condition: LinkageCondition;
  /**
   * The source fields this condition reads (leaf / group keys; empty for an
   * opaque `expression` condition). The `"always"` tracker diffs these between
   * evaluations so an unrelated field change does not re-fire {@link alwaysActions}.
   */
  sourceKeys: string[];
  /**
   * The rule's effect actions, in declaration order — every one fires on the
   * condition's false→true rising edge. State actions (if any) are excluded;
   * they are handled by the state lane.
   */
  actions: EffectAction[];
  /**
   * The subset of {@link actions} whose `retrigger` is `"always"`. These repeat
   * (in declaration order) whenever the condition keeps holding and a source
   * field changes — past the rising edge that already fired every action.
   */
  alwaysActions: EffectAction[];
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
  pushConditionEffectRules(schema.linkage?.rules, result);

  walkNodes(schema, (node, scope) => {
    if (!isRootScope(scope)) {
      return;
    }

    pushConditionEffectRules(node.linkage?.rules, result);
  });

  return result;
}

function pushConditionEffectRules(rules: FieldLinkageRule[] | undefined, out: ConditionEffectRule[]): void {
  const linkageRules = rules ?? [];

  for (const rule of linkageRules) {
    if (rule.trigger.kind !== "condition") {
      continue;
    }

    const actions = rule.actions.filter(action => isEffectAction(action));

    if (actions.length > 0) {
      const sourceKeys = new Set<string>();
      collectConditionSourceKeys(rule.trigger.condition, sourceKeys);

      out.push({
        ruleId: rule.id,
        condition: rule.trigger.condition,
        sourceKeys: [...sourceKeys],
        actions,
        alwaysActions: actions.filter(action => action.retrigger === "always")
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
 * The effect actions to run when a given edge trigger fires. Returns the
 * flattened effect actions of every rule whose trigger matches `kind` (state
 * actions are excluded — they have no meaning on an edge and the validator
 * rejects them there). Used for both field events (`change` / `focus` / `blur` /
 * `click`) and form lifecycle moments (`load` / `beforeSubmit` / `afterSubmit`).
 */
export function getTriggerEffectActions(
  rules: FieldLinkageRule[] | undefined,
  kind: LinkageTriggerKind
): EffectAction[] {
  if (!rules) {
    return [];
  }

  return rules
    .filter(rule => rule.trigger.kind === kind)
    .flatMap(rule => rule.actions.filter(action => isEffectAction(action)));
}

/**
 * The set of field-event edge kinds (`change` / `focus` / `blur` / `click`) a
 * field listens for — drives which DOM handlers the renderer attaches, so a
 * field with no event rules pays nothing.
 */
export function getFieldEventTriggerKinds(
  rules: FieldLinkageRule[] | undefined
): Set<LinkageTriggerKind> {
  const kinds = new Set<LinkageTriggerKind>();
  const linkageRules = rules ?? [];

  for (const rule of linkageRules) {
    if (isFieldEventTriggerKind(rule.trigger.kind) && rule.actions.some(action => isEffectAction(action))) {
      kinds.add(rule.trigger.kind);
    }
  }

  return kinds;
}
