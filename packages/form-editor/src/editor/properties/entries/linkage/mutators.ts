import type {
  FieldLinkage,
  FieldLinkageAction,
  FieldLinkageRule,
  LinkageActionType,
  LinkageCondition,
  LinkageConditionGroup,
  LinkageConditionLeaf,
  LinkageOperator,
  LinkageTrigger,
  LinkageTriggerKind
} from "../../../../types";

import { createId } from "../../../../engine/ids";
import { isStateAction, nextUniqueStepOutput } from "../../../../engine/linkage";
import { operatorNeedsValue } from "./options";

/**
 * Maximum nesting depth the editor UI exposes. Depth 0 = root group;
 * depth 1 = a group nested directly inside the root. Going deeper hurts
 * comprehension; users who need more should switch the rule to
 * expression / script mode.
 */
export const MAX_CONDITION_NESTING_DEPTH = 1;

export function createLeaf(sourceKey: string, operator: LinkageOperator = "eq"): LinkageConditionLeaf {
  return {
    kind: "leaf",
    id: createId("Condition"),
    sourceKey,
    operator,
    ...operatorNeedsValue(operator) && { value: "" }
  };
}

export function createGroup(children: LinkageCondition[] = []): LinkageConditionGroup {
  return {
    kind: "group",
    id: createId("Condition"),
    logic: "all",
    children
  };
}

export function createExpression(): LinkageCondition {
  return {
    kind: "expression",
    id: createId("Condition"),
    source: ""
  };
}

function latestStepOutput(actions: readonly FieldLinkageAction[] | undefined): string | undefined {
  if (actions === undefined) {
    return undefined;
  }

  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index];

    if (
      action !== undefined
      && (action.type === "api_call" || action.type === "select_record")
      && typeof action.output === "string"
      && action.output.length > 0
    ) {
      return action.output;
    }
  }

  return undefined;
}

/**
 * Seed a fresh action of `type`. When `existingActions` is supplied (the
 * rule's current action list), `api_call` and `select_record` allocate
 * rule-unique `output` names (`result`, `result_2`, … / `selected`,
 * `selected_2`, …), and `select_record` defaults its `source` to the latest
 * prior step's output when one exists.
 */
export function createActionFor(
  type: LinkageActionType,
  existingActions?: readonly FieldLinkageAction[]
): FieldLinkageAction {
  const id = createId("Action");

  // Exhaustive over LinkageActionType — payload-free kinds are split so each
  // `type` narrows to a single discriminant, keeping every arm assignment-safe
  // with no widening cast. A new action type makes this fail to compile until
  // it is handled here.
  switch (type) {
    case "assign": {
      return {
        id,
        type,
        value: { kind: "literal", value: "" }
      };
    }

    case "script": {
      return {
        id,
        type,
        source: ""
      };
    }

    case "set_fields": {
      return {
        id,
        type,
        assignments: [{ targetKey: "", value: { kind: "literal", value: "" } }]
      };
    }

    case "set_variable": {
      return {
        id,
        type,
        variable: "",
        value: { kind: "literal", value: "" }
      };
    }

    case "refresh_data_source": {
      return {
        id,
        type,
        dataSourceId: ""
      };
    }

    case "alert": {
      return {
        id,
        type,
        level: "info",
        message: { kind: "literal", value: "" }
      };
    }

    case "navigate": {
      return {
        id,
        type,
        to: { kind: "literal", value: "" }
      };
    }

    case "api_call": {
      return {
        id,
        type,
        request: { resource: "", action: "" },
        output: nextUniqueStepOutput(existingActions ?? [], "result")
      };
    }

    case "select_record": {
      const priorOutput = latestStepOutput(existingActions);

      return {
        id,
        type,
        source: { kind: "reference", path: priorOutput === undefined ? "" : `$steps.${priorOutput}` },
        output: nextUniqueStepOutput(existingActions ?? [], "selected")
      };
    }

    case "show": {
      return { id, type };
    }

    case "hide": {
      return { id, type };
    }

    case "enable": {
      return { id, type };
    }

    case "disable": {
      return { id, type };
    }

    case "require": {
      return { id, type };
    }

    case "optional": {
      return { id, type };
    }

    case "submit": {
      return { id, type };
    }

    case "reset": {
      return { id, type };
    }
  }
}

/**
 * Build a fresh trigger of the given kind. A `condition` trigger seeds a group
 * with one leaf on `sourceKey` (or an empty group when none is available);
 * edge triggers start with no `when` guard.
 */
export function createTrigger(kind: LinkageTriggerKind, sourceKey?: string): LinkageTrigger {
  if (kind === "condition") {
    const children = sourceKey ? [createLeaf(sourceKey)] : [];
    return { kind, condition: createGroup(children) };
  }

  // Edge triggers need no condition; the early return above narrowed `kind` off
  // "condition", so the bare literal is assignable with no cast.
  return { kind };
}

/**
 * Seed a new rule. With a source field it defaults to a `condition` trigger and
 * a `show` action (the classic linkage). Without one (no sibling to reference)
 * it seeds an edge-triggered `alert` so an event-only rule can still be authored
 * — the edge is `change` for a keyed target (fires off its value changing) but
 * `click` for a non-keyed block (button / divider / alert), which carries no
 * value and whose `change` edge the validator rejects.
 */
export function createRule(sourceKey: string | undefined, isTargetKeyed: boolean): FieldLinkageRule {
  if (sourceKey) {
    return {
      id: createId("Rule"),
      trigger: createTrigger("condition", sourceKey),
      actions: [createActionFor("show")]
    };
  }

  return {
    id: createId("Rule"),
    trigger: createTrigger(isTargetKeyed ? "change" : "click"),
    actions: [createActionFor("alert")]
  };
}

/**
 * Reconcile a rule's actions after its trigger changes. State actions are only
 * valid under a `condition` trigger in a state-allowing scope; when the new
 * trigger can't carry them they are stripped (and an `alert` seeded if that
 * empties the list).
 */
export function reconcileRuleTrigger(
  rule: FieldLinkageRule,
  trigger: LinkageTrigger,
  allowStateActions: boolean
): FieldLinkageRule {
  const stateAllowed = allowStateActions && trigger.kind === "condition";
  const actions = stateAllowed
    ? rule.actions
    : rule.actions.filter(action => !isStateAction(action));

  return {
    ...rule,
    trigger,
    actions: actions.length > 0 ? actions : [createActionFor("alert")]
  };
}

/**
 * Switch a rule's trigger kind while preserving every still-applicable guard:
 * - event → event: keeps `when` untouched
 * - event → condition: promotes `when` into `condition` (or seeds a fresh group)
 * - condition → event: carries an authored `condition` into `when`
 *
 * State actions are still reconciled through {@link reconcileRuleTrigger} when
 * leaving a `condition` trigger.
 */
export function switchRuleTrigger(
  rule: FieldLinkageRule,
  nextKind: LinkageTriggerKind,
  allowStateActions: boolean,
  fallbackSourceKey?: string
): FieldLinkageRule {
  if (rule.trigger.kind === nextKind) {
    return rule;
  }

  let nextTrigger: LinkageTrigger;

  if (nextKind === "condition") {
    const promoted = rule.trigger.kind === "condition" ? undefined : rule.trigger.when;

    nextTrigger = promoted === undefined
      ? createTrigger("condition", fallbackSourceKey)
      : { kind: "condition", condition: promoted };
  } else if (rule.trigger.kind === "condition") {
    nextTrigger = conditionHasAuthoredContent(rule.trigger.condition)
      ? { kind: nextKind, when: rule.trigger.condition }
      : { kind: nextKind };
  } else {
    nextTrigger = rule.trigger.when === undefined
      ? { kind: nextKind }
      : { kind: nextKind, when: rule.trigger.when };
  }

  return reconcileRuleTrigger(rule, nextTrigger, allowStateActions);
}

/**
 * Whether switching `rule`'s trigger kind discards user work: since guards now
 * carry across every trigger switch, only leaving a `condition` trigger that
 * holds state actions loses work (the state actions must be stripped).
 */
export function triggerSwitchStripsStateActions(rule: FieldLinkageRule): boolean {
  return rule.trigger.kind === "condition" && rule.actions.some(action => isStateAction(action));
}

/**
 * Whether a condition tree carries user-authored content worth confirming
 * before a destructive replace (group ↔ expression) or carrying across a
 * trigger-kind switch (`condition` → event `when`). A freshly seeded tree — an
 * empty group, or a group holding exactly one pristine leaf (default `eq`
 * operator, no value typed) — is trivially reconstructible; anything beyond
 * that carries real authored logic.
 */
export function conditionHasAuthoredContent(condition: LinkageCondition): boolean {
  let current = condition;

  while (current.kind === "group") {
    const { children } = current;

    if (children.length === 0) {
      return false;
    }

    if (children.length !== 1 || children[0] === undefined) {
      return true;
    }

    current = children[0];
  }

  if (current.kind === "expression") {
    return current.source.trim().length > 0;
  }

  // The sourceKey is auto-seeded, so it alone does not count as authored.
  return current.operator !== "eq" || (current.value !== "" && current.value !== undefined);
}

/**
 * Seed a new form-scope (global "events") rule. With a root source field it
 * defaults to a form-wide `condition`; otherwise to an `afterSubmit` lifecycle
 * trigger. Either way the default action is an `alert` (effect-only, since the
 * form has no self field to derive state for).
 */
export function createFormRule(sourceKey?: string): FieldLinkageRule {
  return {
    id: createId("Rule"),
    trigger: sourceKey ? createTrigger("condition", sourceKey) : createTrigger("afterSubmit"),
    actions: [createActionFor("alert")]
  };
}

/**
 * Strips empty defaults / rules arrays so the persisted schema stays
 * minimal. Returning `undefined` from this helper lets the caller delete
 * the `linkage` key entirely when nothing is left.
 */
export function normalizeLinkage(linkage: FieldLinkage): FieldLinkage | undefined {
  const { defaults } = linkage;
  const hasDefaults = defaults
    && (defaults.hidden === true || defaults.disabled === true || defaults.required === true);
  const nextDefaults = hasDefaults
    ? {
        ...(defaults.hidden === true) && { hidden: true },
        ...(defaults.disabled === true) && { disabled: true },
        ...(defaults.required === true) && { required: true }
      }
    : undefined;
  const nextRules = linkage.rules?.length ? linkage.rules : undefined;

  if (!nextDefaults && !nextRules) {
    return undefined;
  }

  return {
    ...nextDefaults && { defaults: nextDefaults },
    ...nextRules && { rules: nextRules }
  };
}

/**
 * Immutably updates a single child within a group condition addressed by
 * `path` (a sequence of child indices from the root). Returns the new
 * root condition; the original tree is unchanged.
 */
export function updateAtPath(
  root: LinkageCondition,
  path: number[],
  updater: (current: LinkageCondition) => LinkageCondition
): LinkageCondition {
  if (path.length === 0) {
    return updater(root);
  }

  if (root.kind !== "group") {
    return root;
  }

  const [head, ...rest] = path;
  const nextChildren = root.children.map((child, index) => index === head ? updateAtPath(child, rest, updater) : child);

  return { ...root, children: nextChildren };
}

export function removeAtPath(root: LinkageCondition, path: number[]): LinkageCondition {
  if (path.length === 0 || root.kind !== "group") {
    return root;
  }

  if (path.length === 1) {
    const [head] = path;
    return {
      ...root,
      children: root.children.filter((_, index) => index !== head)
    };
  }

  const [head, ...rest] = path;
  const nextChildren = root.children.map((child, index) => index === head ? removeAtPath(child, rest) : child);

  return { ...root, children: nextChildren };
}

export function appendChild(
  root: LinkageCondition,
  groupPath: number[],
  child: LinkageCondition
): LinkageCondition {
  return updateAtPath(root, groupPath, group => {
    if (group.kind !== "group") {
      return group;
    }

    return { ...group, children: [...group.children, child] };
  });
}
