import type { Block, FormField, PresentationLayer } from "../../types";

import { mapPreservingIdentity } from "./nodes";
import { rewriteContainerBodies } from "./rewrite";
import { isLeafField } from "./walk";

/**
 * Pure tree mutators over the block-tree schema. Every function returns a new
 * schema; inputs are never mutated. Matching is by node `id`, which is unique
 * across the whole tree, so a single id locates a node at any depth.
 *
 * The editor store composes these with positional helpers (insert / beside /
 * move); these are the structural primitives underneath.
 */

type BlockUpdater = (block: Block) => Block;

// Structural sharing: every rewrite/prune helper returns the *original* array or
// node reference when nothing beneath it changed, so only the branch on the path
// to the mutated id gets fresh identities. This lets the canvas memoize blocks by
// reference — a single property edit re-renders one branch, not the whole tree.
// The exported mutators extend the same identity contract to the layer: a no-op
// (missing id, or an updater that returns its input) returns the **input schema
// reference**, so the store detects it with `===`.

function rewriteBlocks(blocks: Block[], id: string, updater: BlockUpdater): Block[] {
  return mapPreservingIdentity(blocks, block => {
    if (block.id === id) {
      return updater(block);
    }

    return rewriteContainerBodies(block, body => rewriteBlocks(body, id, updater));
  });
}

/**
 * Replace the node whose id matches via a pure updater. The updater must
 * return a block of the same kind; callers that narrow first (see
 * {@link editField}) keep this safe.
 *
 * Identity contract: when nothing changes — the id is not in the tree, or the
 * updater returns its input — the **input schema reference** is returned.
 */
export function updateNode(schema: PresentationLayer, id: string, updater: BlockUpdater): PresentationLayer {
  const children = rewriteBlocks(schema.children, id, updater);

  return children === schema.children ? schema : { ...schema, children };
}

function pruneBlocks(blocks: Block[], id: string): Block[] {
  let changed = false;
  const next: Block[] = [];

  for (const block of blocks) {
    if (block.id === id) {
      changed = true;
      continue;
    }

    const pruned = rewriteContainerBodies(block, body => pruneBlocks(body, id));

    if (pruned !== block) {
      changed = true;
    }

    next.push(pruned);
  }

  return changed ? next : blocks;
}

/**
 * Remove the block with the given id from anywhere in the tree. A container
 * emptied of its last block stays in place (it remains a valid drop target);
 * only the targeted node is removed.
 *
 * Raw tree mutator: it does NOT touch linkage references (named `removeBlock`
 * so it can never be mistaken for the store's `removeNode` action, which
 * additionally prunes references to the dying keys in the same undo step).
 *
 * Identity contract: when the id is not in the tree, the **input schema
 * reference** is returned.
 */
export function removeBlock(schema: PresentationLayer, id: string): PresentationLayer {
  const children = pruneBlocks(schema.children, id);

  return children === schema.children ? schema : { ...schema, children };
}

/**
 * Apply a pure updater to a single leaf field, matched by id. Non-field nodes
 * with that id are left untouched (returning the input schema reference, per
 * the {@link updateNode} identity contract). The properties panel forwards
 * updaters from typed `PropertyEntry.write` lenses, so per-property type
 * safety is preserved at the entry-declaration site.
 */
export function editField(
  schema: PresentationLayer,
  fieldId: string,
  updater: (field: FormField) => FormField
): PresentationLayer {
  return updateNode(schema, fieldId, node => isLeafField(node) ? updater(node) : node);
}
