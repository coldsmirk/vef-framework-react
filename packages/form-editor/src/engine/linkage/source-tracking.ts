import type { FieldLinkage, LinkageCondition } from "../../types";

import { isRecord } from "../validation";
import { isStateAction } from "./taxonomy";

/**
 * Any node that may carry linkage — a leaf field or a container block.
 */
interface LinkageBearer {
  linkage?: FieldLinkage;
}

/**
 * Collects the keys of every source field whose value drives this node's
 * derived state. Used by the runtime renderer to scope per-field re-validation
 * (TanStack Form's `onChangeListenTo`).
 *
 * Only `condition`-triggered rules carrying a **state** action are counted: they
 * are the rules that make this field's hidden / disabled / required state — and
 * therefore its validation — depend on another field's value. Effect-only rules
 * and edge-triggered (event) rules add no keys; their work happens on the
 * effect lane, not in this field's validator.
 *
 * Expression conditions return no keys — the expression evaluator is opaque to
 * the framework. Authors using `expression` must trust the runtime to
 * re-evaluate on any value change.
 */
export function getLinkageSourceKeys(node: LinkageBearer): string[] {
  const rules = node.linkage?.rules ?? [];
  const sourceKeys = new Set<string>();

  for (const rule of rules) {
    // Shape guard: this runs on the render path against host-supplied schemas
    // that may never have been validated — a malformed rule contributes no
    // keys instead of crashing.
    if (!isRecord(rule) || !isRecord(rule.trigger) || rule.trigger.kind !== "condition") {
      continue;
    }

    if (!Array.isArray(rule.actions) || rule.actions.every(action => !isRecord(action) || !isStateAction(action))) {
      continue;
    }

    collectConditionSourceKeys(rule.trigger.condition, sourceKeys);
  }

  return [...sourceKeys];
}

/**
 * A condition's form-value dependencies, plus whether any part of it is opaque
 * — i.e. reads inputs that cannot be enumerated statically.
 *
 * Only an `expression` condition is opaque. A `$`-rooted leaf
 * (`$user.departmentId`) has a perfectly knowable dependency; it just is not a
 * form value, so it contributes no key while leaving the condition
 * enumerable. Collapsing the two into "empty key set" is what let a context
 * condition be treated as opaque, which the `always` retrigger reads as
 * "re-fire on any value change".
 */
export function describeConditionSources(condition: LinkageCondition): { keys: string[]; opaque: boolean } {
  const keys = new Set<string>();
  const opaque = collectConditionSourceKeys(condition, keys);

  return { keys: [...keys], opaque };
}

/**
 * Collect a condition's form-value source keys into `out`, returning whether
 * any visited node was opaque (see {@link describeConditionSources}).
 */
export function collectConditionSourceKeys(
  condition: LinkageCondition,
  out: Set<string>
): boolean {
  // Mirrors matchCondition's shape defense: a malformed node yields no keys.
  // It is not opaque either — a rule that cannot be evaluated cannot depend on
  // anything.
  if (!isRecord(condition)) {
    return false;
  }

  if (condition.kind === "leaf") {
    // A `$`-rooted context path ($user.x / $vars.x / …) is not a form value:
    // its changes arrive through the evaluation context, which re-evaluates
    // the whole scope — so like an expression condition it contributes no
    // per-field source key.
    if (typeof condition.sourceKey === "string" && condition.sourceKey.length > 0 && !condition.sourceKey.startsWith("$")) {
      out.add(condition.sourceKey);
    }

    return false;
  }

  if (condition.kind === "expression") {
    return true;
  }

  if (condition.kind === "group" && Array.isArray(condition.children)) {
    let opaque = false;

    for (const child of condition.children) {
      // Not short-circuited: every child still contributes its keys.
      opaque = collectConditionSourceKeys(child, out) || opaque;
    }

    return opaque;
  }

  return false;

  // Expression sources are opaque — re-evaluation must come from a
  // broader trigger than a single source key.
}
