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
import { ruleActions, ruleCondition, ruleTriggerKind } from "./shape";
import { describeConditionSources } from "./source-tracking";
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
   * The FORM-VALUE fields this condition reads. The `"always"` tracker diffs
   * these between evaluations so an unrelated field change does not re-fire
   * {@link alwaysActions}. Empty is a real answer — a condition on a `$`-rooted
   * context path depends on nothing in the form — and must not be confused with
   * {@link opaque}.
   */
  sourceKeys: string[];
  /**
   * Whether the condition reads inputs that cannot be enumerated (an
   * `expression` condition). Only then does the tracker fall back to diffing
   * the whole values object; treating an empty {@link sourceKeys} as opaque
   * turned a context-only condition's `"always"` actions into one dispatch per
   * keystroke anywhere on the form.
   */
  opaque: boolean;
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
  const linkageRules = Array.isArray(rules) ? rules : [];

  for (const rule of linkageRules) {
    const condition = ruleCondition(rule);

    if (condition === undefined) {
      continue;
    }

    const actions = ruleActions(rule).filter(action => isEffectAction(action));

    if (actions.length > 0) {
      const sources = describeConditionSources(condition);

      out.push({
        ruleId: rule.id,
        condition,
        sourceKeys: sources.keys,
        opaque: sources.opaque,
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
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules
    .filter(rule => ruleTriggerKind(rule) === kind)
    .flatMap(rule => ruleActions(rule).filter(action => isEffectAction(action)));
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
  const linkageRules = Array.isArray(rules) ? rules : [];

  for (const rule of linkageRules) {
    const kind = ruleTriggerKind(rule);

    if (kind !== undefined && isFieldEventTriggerKind(kind) && ruleActions(rule).some(action => isEffectAction(action))) {
      kinds.add(kind);
    }
  }

  return kinds;
}
