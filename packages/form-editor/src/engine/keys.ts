import type { Block, FormField, KeyedFormField, KeyedNodeUnion, PresentationLayer, Validatable } from "../types";
import type { ScopePath } from "./schema/walk";

import { scopeEquals, walkNodes } from "./schema/walk";

/**
 * Generate a unique data-binding key for a keyed node within a value scope.
 *
 * Keys are unique **per scope**, not globally: a subform template opens a new
 * scope, so its fields may reuse a key that also exists in the outer form
 * (their runtime path is `lines[i].amount`, never colliding with a root
 * `amount`). Pass the scope the node will live in; the root scope is `[]`.
 *
 * Tries the bare base first, then `${base}_2`, `${base}_3`, … until an unused
 * key is found. Deterministic, so schemas stay readable while silent
 * collisions are prevented when several keyed nodes of the same type are added.
 */
export function generateUniqueKey(schema: PresentationLayer, baseKey: string, scope: ScopePath = []): string {
  return nextUniqueKey(collectScopeKeys(schema, scope), baseKey);
}

/**
 * Allocate a key not already in `used`, recording the result back into the set
 * so repeated calls stay unique. Lets a deep clone mint many keys in one pass.
 */
export function nextUniqueKey(used: Set<string>, baseKey: string): string {
  let key = baseKey;

  if (used.has(key)) {
    let suffix = 2;

    while (used.has(`${baseKey}_${suffix}`)) {
      suffix += 1;
    }

    key = `${baseKey}_${suffix}`;
  }

  used.add(key);

  return key;
}

/**
 * Strip characters reserved by the value-path / scope machinery (`.`, `[`,
 * `]`, `/`) — in fact any non-word character — from a user-typed key, so a key
 * can never break field binding or per-scope resolution. May return `""` for an
 * all-invalid input; callers must apply their own non-empty fallback.
 */
export function sanitizeKey(key: string): string {
  return key.replaceAll(/\W/g, "");
}

/**
 * Structural guard: a node binds a value (carries a **non-empty** `key`).
 * Catches both keyed leaf fields and the subform. Narrows to
 * {@link KeyedNodeUnion} so callers need no follow-up cast. An empty-string key
 * is treated as non-keyed — matching `validateSchema`, which only registers a
 * key of length > 0, so the runtime never binds a value to an empty path.
 */
export function isKeyedNode(node: Block): node is KeyedNodeUnion {
  const { key } = node as { key?: unknown };

  return typeof key === "string" && key.length > 0;
}

/**
 * Structural guard narrowing a leaf field to its keyed variant (a **non-empty**
 * `key`). Tied to the `FormField` union; for checks that must also catch a
 * subform, use {@link isKeyedNode}.
 */
export function isKeyedField(field: FormField): field is KeyedFormField {
  const { key } = field as { key?: unknown };

  return typeof key === "string" && key.length > 0;
}

/**
 * Structural guard for a field that carries the {@link Validatable} `validate`
 * slot (textfield / code-editor / number). Lets callers read `field.validate`
 * across the field union without a cast.
 */
export function isValidatableField(field: FormField): field is FormField & Validatable {
  return "validate" in field;
}

/**
 * Collect the data-binding keys used directly within one value scope (siblings
 * that must stay mutually unique). Keys nested under a deeper subform scope are
 * excluded — they live in their own namespace.
 */
export function collectScopeKeys(schema: PresentationLayer, scope: ScopePath): Set<string> {
  const used = new Set<string>();

  walkNodes(schema, (node, nodeScope) => {
    if (isKeyedNode(node) && scopeEquals(nodeScope, scope)) {
      used.add(node.key);
    }
  });

  return used;
}

/**
 * The data-binding keys living in one value scope — the unit
 * {@link collectSubtreeKeysByScope} buckets a removed subtree into and the
 * reconcile prune primitives consume.
 */
export interface ScopeKeyBucket {
  scope: ScopePath;
  keys: Set<string>;
}

/**
 * Collect the data-binding keys carried by `node` and every node beneath it,
 * bucketed by the value scope each key lives in. `baseScope` is the scope the
 * subtree's root sits in; nested subform templates open deeper scopes. Feeds
 * `pruneKeyReferences` when the subtree is removed (and the removal-impact
 * simulation that previews that prune).
 */
export function collectSubtreeKeysByScope(node: Block, baseScope: ScopePath): ScopeKeyBucket[] {
  const buckets = new Map<string, ScopeKeyBucket>();

  walkNodes({ children: [node] }, (descendant, relativeScope) => {
    if (!isKeyedNode(descendant)) {
      return;
    }

    const scope: ScopePath = [...baseScope, ...relativeScope];
    const scopeId = scope.join("/");
    const bucket = buckets.get(scopeId) ?? { scope, keys: new Set<string>() };

    bucket.keys.add(descendant.key);
    buckets.set(scopeId, bucket);
  });

  return [...buckets.values()];
}
