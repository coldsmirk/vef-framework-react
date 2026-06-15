import type {
  FieldLinkage,
  FieldLinkageAction,
  FieldLinkageRule,
  LinkageActionType,
  LinkageActionValue,
  LinkageCondition,
  LinkageConditionGroup,
  LinkageConditionLeaf,
  LinkageOperator,
  LinkageTrigger,
  LinkageTriggerKind
} from "../../../../types";

import { createId } from "../../../../engine/ids";
import { isEffectAction, isStateAction } from "../../../../engine/linkage";

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
    value: ""
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

export function createActionFor(type: LinkageActionType): FieldLinkageAction {
  const id = createId("Action");

  // Exhaustive over LinkageActionType — payload-free kinds are split so each
  // `type` narrows to a single discriminant, keeping every arm assignment-safe
  // with no widening cast. A new action type makes this fail to compile until
  // it is handled here.
  switch (type) {
    case "assign": { return {
      id,
      type,
      value: { kind: "literal", value: "" }
    }; }

    case "script": { return {
      id,
      type,
      source: ""
    }; }

    case "set_field": { return {
      id,
      type,
      targetKey: "",
      value: { kind: "literal", value: "" }
    }; }

    case "set_variable": { return {
      id,
      type,
      variable: "",
      value: { kind: "literal", value: "" }
    }; }

    case "refresh_data_source": { return {
      id,
      type,
      dataSourceId: ""
    }; }

    case "alert": { return {
      id,
      type,
      level: "info",
      message: { kind: "literal", value: "" }
    }; }

    case "navigate": { return {
      id,
      type,
      to: { kind: "literal", value: "" }
    }; }

    case "api_call": { return {
      id,
      type,
      request: { resource: "", action: "" }
    }; }

    case "show":
    case "hide":
    case "enable":
    case "disable":
    case "require":
    case "optional": { return { id, type }; }

    case "submit": { return { id, type }; }

    case "reset": { return { id, type }; }
  }
}

/**
 * Build a fresh trigger of the given kind. A `condition` trigger seeds a group
 * with one leaf on `sourceKey` (or an empty group when none is available);
 * edge triggers carry no payload.
 */
export function createTrigger(kind: LinkageTriggerKind, sourceKey?: string): LinkageTrigger {
  if (kind === "condition") {
    return { kind, condition: sourceKey ? createGroup([createLeaf(sourceKey)]) : createGroup([]) };
  }

  // Edge triggers are payload-free; the early return above narrowed `kind` off
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
 * Drop a now-meaningless `retrigger` from an effect action. Used when a rule
 * moves to an edge trigger: edges already pulse per event, so a kept
 * `retrigger` would be dead configuration the validator flags
 * (`retrigger_ignored`). Identity-preserving when there is nothing to strip.
 */
function stripRetrigger(action: FieldLinkageAction): FieldLinkageAction {
  if (!isEffectAction(action) || action.retrigger === undefined) {
    return action;
  }

  const next = { ...action };

  delete next.retrigger;

  return next;
}

/**
 * Reconcile a rule's actions after its trigger changes. State actions are only
 * valid under a `condition` trigger in a state-allowing scope; when the new
 * trigger can't carry them they are stripped (and an `alert` seeded if that
 * empties the list). Moving to an edge trigger also strips each surviving
 * effect's `retrigger` (meaningless there), so the editor never commits a rule
 * the validator flags.
 */
export function reconcileRuleTrigger(
  rule: FieldLinkageRule,
  trigger: LinkageTrigger,
  allowStateActions: boolean
): FieldLinkageRule {
  const stateAllowed = allowStateActions && trigger.kind === "condition";
  let actions = stateAllowed
    ? rule.actions
    : rule.actions.filter(action => !isStateAction(action));

  if (trigger.kind !== "condition") {
    actions = actions.map(action => stripRetrigger(action));
  }

  return {
    ...rule,
    trigger,
    actions: actions.length > 0 ? actions : [createActionFor("alert")]
  };
}

/**
 * Whether a condition tree carries user-authored content worth confirming
 * before a destructive replace (group ↔ expression, trigger-kind change). A
 * freshly seeded tree — an empty group, or a group holding exactly one
 * pristine leaf (default `eq` operator, no value typed) — is trivially
 * reconstructible, so switching away from it stays instant; anything beyond
 * that loses real work and deserves a confirmation.
 */
export function conditionHasAuthoredContent(condition: LinkageCondition): boolean {
  switch (condition.kind) {
    case "expression": {
      return condition.source.trim().length > 0;
    }

    case "leaf": {
      // The sourceKey is auto-seeded, so it alone does not count as authored.
      return condition.operator !== "eq" || (condition.value !== "" && condition.value !== undefined);
    }

    case "group": {
      const { children } = condition;

      if (children.length === 0) {
        return false;
      }

      if (children.length === 1 && children[0] !== undefined) {
        return conditionHasAuthoredContent(children[0]);
      }

      return true;
    }
  }
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
        ...defaults.hidden === true ? { hidden: true } : {},
        ...defaults.disabled === true ? { disabled: true } : {},
        ...defaults.required === true ? { required: true } : {}
      }
    : undefined;
  const nextRules = linkage.rules?.length ? linkage.rules : undefined;

  if (!nextDefaults && !nextRules) {
    return undefined;
  }

  return {
    ...nextDefaults ? { defaults: nextDefaults } : {},
    ...nextRules ? { rules: nextRules } : {}
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

export type ActionValueMode = LinkageActionValue["kind"];

/**
 * Switch a {@link LinkageActionValue} between literal and expression mode,
 * preserving the value when the mode is unchanged. Shared by every value-bearing
 * action editor (`assign` / `set_field` / `alert` / `navigate`).
 */
export function setActionValueMode(
  current: LinkageActionValue,
  mode: ActionValueMode
): LinkageActionValue {
  if (mode === "literal") {
    return current.kind === "literal" ? current : { kind: "literal", value: "" };
  }

  return current.kind === "expression" ? current : { kind: "expression", source: "" };
}
