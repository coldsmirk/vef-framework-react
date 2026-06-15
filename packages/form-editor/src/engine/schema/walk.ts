import type { Block, ContainerNode, FormField, PresentationLayer } from "../../types";

import { isShallowEqual } from "@vef-framework-react/shared";

import { CONTAINER_TYPES } from "../../types";
import { bodyScopeKey, containerBodies } from "./nodes";

/**
 * Scope path of a node: the chain of subform keys enclosing it. The root
 * scope is `[]`; a node inside subform `"lines"` is `["lines"]`; nested
 * subforms append further keys. Per-scope key uniqueness and runtime value
 * binding both key off this path.
 */
export type ScopePath = readonly string[];

/**
 * Container type discriminants, derived from {@link CONTAINER_TYPES} (itself
 * compile-checked against the `ContainerNode` union) so there is exactly one
 * source of truth.
 */
const CONTAINER_TYPE_SET: ReadonlySet<string> = new Set<string>(CONTAINER_TYPES);

export function isContainerNode(node: Block): node is ContainerNode {
  return CONTAINER_TYPE_SET.has(node.type);
}

/**
 * A leaf field is any node that is not a container. Defined by exclusion so
 * consumer-augmented field types (arbitrary `type` strings) narrow correctly.
 */
export function isLeafField(node: Block): node is FormField {
  return !CONTAINER_TYPE_SET.has(node.type);
}

/**
 * Whether two scope paths are equal (same subform-key chain).
 */
export function scopeEquals(a: ScopePath, b: ScopePath): boolean {
  return isShallowEqual(a, b);
}

/**
 * The PC root scope (the empty path). Linkage state, defaults, and the form-level
 * events all resolve here; subform templates open deeper scopes and are evaluated
 * per row, so traversals that only handle the top level skip non-root nodes.
 */
export function isRootScope(scope: ScopePath): boolean {
  return scope.length === 0;
}

/**
 * The human-facing label of a node: its `label`, else its `title`, else
 * `undefined`. Both are optional probes on the union (fields carry `label`,
 * sections/tabs carry `title`), read through `in`-narrowing and required to be
 * non-empty so a blank string never masks a caller's own fallback. Callers
 * supply the fallback (`?? node.id`, `?? node.key`, `?? config.name`) they want.
 */
export function nodeLabel(node: Block): string | undefined {
  if ("label" in node && typeof node.label === "string" && node.label.length > 0) {
    return node.label;
  }

  if ("title" in node && typeof node.title === "string" && node.title.length > 0) {
    return node.title;
  }

  return undefined;
}

function eachNode(
  node: Block,
  scope: ScopePath,
  visit: (node: Block, scope: ScopePath) => void
): void {
  visit(node, scope);

  if (isContainerNode(node)) {
    const key = bodyScopeKey(node);
    const inner: ScopePath = key === undefined ? scope : [...scope, key];

    for (const body of containerBodies(node)) {
      for (const block of body) {
        eachNode(block, inner, visit);
      }
    }
  }

  // Leaf field — no children to recurse into.
}

/**
 * Depth-first walk of every block in the tree (including the blocks nested
 * inside containers). The visitor receives each block along with its
 * {@link ScopePath}.
 */
export function walkNodes(
  schema: PresentationLayer,
  visit: (node: Block, scope: ScopePath) => void
): void {
  for (const block of schema.children) {
    eachNode(block, [], visit);
  }
}

/**
 * Depth-first walk of every leaf field in the tree, recursing through all
 * containers and subform templates. The visitor receives each field and its
 * {@link ScopePath}.
 */
export function walkFields(
  schema: PresentationLayer,
  visit: (field: FormField, scope: ScopePath) => void
): void {
  walkNodes(schema, (node, scope) => {
    if (isLeafField(node)) {
      visit(node, scope);
    }
  });
}

/**
 * Count every leaf field in the tree, across all containers and subform
 * templates. Backs the editor's "field count" stat.
 */
export function countFields(schema: PresentationLayer): number {
  let count = 0;

  walkFields(schema, () => {
    count += 1;
  });

  return count;
}

/**
 * Depth-first search returning the first non-`undefined` result from `pick`,
 * stopping the walk as soon as it is found. Backs the `find*` helpers so they
 * bail at the first match rather than walking the whole tree (the previous
 * last-write-wins pattern). For a well-formed tree (unique ids) the result is
 * identical; for a malformed one this makes first-match explicit and faster.
 */
function findFirst<T>(
  schema: PresentationLayer,
  pick: (node: Block, scope: ScopePath) => T | undefined
): T | undefined {
  function search(node: Block, scope: ScopePath): T | undefined {
    const picked = pick(node, scope);

    if (picked !== undefined) {
      return picked;
    }

    if (isContainerNode(node)) {
      const key = bodyScopeKey(node);
      const inner: ScopePath = key === undefined ? scope : [...scope, key];

      for (const body of containerBodies(node)) {
        for (const block of body) {
          const hit = search(block, inner);

          if (hit !== undefined) {
            return hit;
          }
        }
      }
    }

    return undefined;
  }

  for (const block of schema.children) {
    const hit = search(block, []);

    if (hit !== undefined) {
      return hit;
    }
  }

  return undefined;
}

/**
 * Find any node by id within the tree. Returns `undefined` when missing.
 */
export function findNode(schema: PresentationLayer, id: string): Block | undefined {
  return findFirst(schema, node => node.id === id ? node : undefined);
}

/**
 * Find a leaf field by id within the tree. Returns `undefined` when missing.
 */
export function findField(schema: PresentationLayer, id: string): FormField | undefined {
  const node = findNode(schema, id);

  return node && isLeafField(node) ? node : undefined;
}

/**
 * The {@link ScopePath} a node lives in (the subform-key chain enclosing it),
 * or `undefined` when the id is not in the tree.
 */
export function findScope(schema: PresentationLayer, id: string): ScopePath | undefined {
  return findFirst(schema, (node, scope) => node.id === id ? scope : undefined);
}

/**
 * Collect the ids of `node` and every node beneath it.
 */
export function collectNodeIds(node: Block): Set<string> {
  const ids = new Set<string>();

  eachNode(node, [], descendant => {
    ids.add(descendant.id);
  });

  return ids;
}

/**
 * Whether `candidateId` is `root` itself or any node nested beneath it. Used to
 * reject moving a container onto a drop target inside its own subtree (which
 * would otherwise delete the dragged subtree).
 */
export function containsNode(root: Block, candidateId: string): boolean {
  return collectNodeIds(root).has(candidateId);
}

/**
 * The container that directly owns the block with the given id (the container
 * whose body holds the block), or `undefined` when the block sits at the root.
 * Drives layout decisions that depend on the parent — e.g. a block under a flex
 * container is sized by `flex`, under any other parent by `span`.
 */
export function findParentContainer(schema: PresentationLayer, blockId: string): ContainerNode | undefined {
  return findFirst(schema, node => {
    if (!isContainerNode(node)) {
      return;
    }

    for (const body of containerBodies(node)) {
      if (body.some(block => block.id === blockId)) {
        return node;
      }
    }
  });
}

/**
 * Locate a node by id together with the container that directly owns it, in a
 * single depth-first pass. Equivalent to {@link findNode} plus
 * {@link findParentContainer} for the same id, but walks the tree once — the
 * properties panel resolves both on every property keystroke. `parent` is
 * `undefined` for a node sitting at the root.
 */
export function findNodeWithParentContainer(
  schema: PresentationLayer,
  id: string
): { node: Block; parent: ContainerNode | undefined } | undefined {
  function search(
    node: Block,
    parent?: ContainerNode
  ): { node: Block; parent: ContainerNode | undefined } | undefined {
    if (node.id === id) {
      return { node, parent };
    }

    if (isContainerNode(node)) {
      for (const body of containerBodies(node)) {
        for (const block of body) {
          const hit = search(block, node);

          if (hit !== undefined) {
            return hit;
          }
        }
      }
    }

    return undefined;
  }

  for (const block of schema.children) {
    const hit = search(block);

    if (hit !== undefined) {
      return hit;
    }
  }

  return undefined;
}
