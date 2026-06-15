import type { FieldLinkage, LinkageCondition } from "../../types";

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
 * Expression conditions return no keys — the host-supplied evaluator is
 * opaque to the framework. Authors using `expression` must trust the
 * runtime to re-evaluate on any value change.
 */
export function getLinkageSourceKeys(node: LinkageBearer): string[] {
  const rules = node.linkage?.rules ?? [];
  const sourceKeys = new Set<string>();

  for (const rule of rules) {
    if (rule.trigger.kind !== "condition" || !rule.actions.some(action => isStateAction(action))) {
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
  if (condition.kind === "leaf") {
    if (condition.sourceKey.length > 0) {
      out.add(condition.sourceKey);
    }

    return;
  }

  if (condition.kind === "group") {
    for (const child of condition.children) {
      collectConditionSourceKeys(child, out);
    }
  }

  // Expression sources are opaque — re-evaluation must come from a
  // broader trigger than a single source key.
}
