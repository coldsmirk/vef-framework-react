import type { Block } from "../../types";

import { containerBodies, mapPreservingIdentity, withContainerBodies } from "./nodes";
import { isContainerNode } from "./walk";

/**
 * Rewrite a container's child block-lists through `transformBody`, preserving
 * identity: when every body returns its own reference (nothing beneath changed),
 * the original `block` reference is returned, so the reference-equality bail-outs
 * the canvas memoization and reconcile passes depend on still fire. A non-container
 * block is returned untouched.
 *
 * This is the one structural-sharing recursion primitive. The tree operations in
 * `mutate` (rewrite / prune), `edit-ops` (insert / append / move), and
 * `reconcile` all descend through it instead of re-deriving the
 * `containerBodies → map → withContainerBodies` skeleton, so the per-keystroke
 * identity contract lives in exactly one place.
 */
export function rewriteContainerBodies(block: Block, transformBody: (body: Block[]) => Block[]): Block {
  if (!isContainerNode(block)) {
    return block;
  }

  const bodies = containerBodies(block);
  const nextBodies = mapPreservingIdentity(bodies, transformBody);

  return nextBodies === bodies ? block : withContainerBodies(block, nextBodies);
}
