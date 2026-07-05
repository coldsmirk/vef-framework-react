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

export function collectConditionSourceKeys(
  condition: LinkageCondition,
  out: Set<string>
): void {
  // Mirrors matchCondition's shape defense: a malformed node yields no keys.
  if (!isRecord(condition)) {
    return;
  }

  if (condition.kind === "leaf") {
    // A `$`-rooted context path ($user.x / $vars.x / …) is not a form value:
    // its changes arrive through the evaluation context, which re-evaluates
    // the whole scope — so like an expression condition it contributes no
    // per-field source key.
    if (typeof condition.sourceKey === "string" && condition.sourceKey.length > 0 && !condition.sourceKey.startsWith("$")) {
      out.add(condition.sourceKey);
    }

    return;
  }

  if (condition.kind === "group" && Array.isArray(condition.children)) {
    for (const child of condition.children) {
      collectConditionSourceKeys(child, out);
    }
  }

  // Expression sources are opaque — re-evaluation must come from a
  // broader trigger than a single source key.
}
