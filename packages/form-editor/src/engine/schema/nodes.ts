import type { Block, ContainerNode, FormSchema } from "../../types";

import { createId } from "../ids";

/**
 * Map an array through `transform`, returning the original array reference when
 * no element changed. The foundational structural-sharing primitive: it is what
 * lets a single deep edit rebuild only its own path while every untouched branch
 * keeps its identity, so memoized canvas rows and reconcile passes can bail on
 * reference equality.
 */
export function mapPreservingIdentity<T>(items: T[], transform: (item: T) => T): T[] {
  let changed = false;
  const next = items.map(item => {
    const mapped = transform(item);

    if (mapped !== item) {
      changed = true;
    }

    return mapped;
  });

  return changed ? next : items;
}

/**
 * A fresh, empty schema.
 */
export function createEmptySchema(): FormSchema {
  return {
    id: createId("Form"),
    version: 2,
    presentations: { pc: { children: [] } }
  };
}

/**
 * The child block-lists a container owns, in a stable order: `[children]` for a
 * section, one list per tab for `tabs`, `[template]` for a subform.
 *
 * This is the single place the heterogeneous container shape is encoded —
 * walkers, mutators, and structural edit-ops consume it (together with
 * {@link withContainerBodies}) instead of each re-switching on node type.
 */
export function containerBodies(node: ContainerNode): Block[][] {
  switch (node.type) {
    case "section": {
      return [node.children];
    }

    case "tabs": {
      return node.tabs.map(tab => tab.children);
    }

    case "subform": {
      return [node.template];
    }

    case "flex": {
      return [node.children];
    }

    case "grid": {
      return [node.children];
    }
  }
}

/**
 * Rebuild a container from transformed block-lists, in the same order and arity
 * {@link containerBodies} produced them. The inverse of `containerBodies`;
 * together they let a consumer transform a container's bodies without knowing
 * which field holds them.
 */
export function withContainerBodies(node: ContainerNode, bodies: Block[][]): ContainerNode {
  switch (node.type) {
    case "section": {
      return { ...node, children: bodies[0] ?? [] };
    }

    case "tabs": {
      return {
        ...node,
        tabs: node.tabs.map((tab, index) => {
          const body = bodies[index] ?? [];

          // Identity-preserving: an untouched tab keeps its wrapper object so
          // memoized chrome keyed on it skips — the same per-keystroke
          // structural-sharing contract the block rewrites honor.
          return body === tab.children ? tab : { ...tab, children: body };
        })
      };
    }

    case "subform": {
      return { ...node, template: bodies[0] ?? [] };
    }

    case "flex": {
      return { ...node, children: bodies[0] ?? [] };
    }

    case "grid": {
      return { ...node, children: bodies[0] ?? [] };
    }
  }
}

/**
 * The subform key a container opens as a new value scope, or `undefined` when
 * the container keeps the enclosing scope (sections and tabs do not rebind).
 */
export function bodyScopeKey(node: ContainerNode): string | undefined {
  return node.type === "subform" ? node.key : undefined;
}
