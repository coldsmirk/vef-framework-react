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
import { isStateAction } from "../../../../engine/linkage";

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
        request: { resource: "", action: "" }
      };
    }

    case "select_record": {
      return {
        id,
        type,
        source: { kind: "reference", path: "" },
        output: "selected"
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

export function createTrigger(kind: LinkageTriggerKind, sourceKey?: string): LinkageTrigger {
  if (kind === "condition") {
    const children = sourceKey ? [createLeaf(sourceKey)] : [];
    return { kind, condition: createGroup(children) };
  }

  return { kind };
}

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

  return current.operator !== "eq" || (current.value !== "" && current.value !== undefined);
}

export function createFormRule(sourceKey?: string): FieldLinkageRule {
  return {
    id: createId("Rule"),
    trigger: sourceKey ? createTrigger("condition", sourceKey) : createTrigger("afterSubmit"),
    actions: [createActionFor("alert")]
  };
}

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
