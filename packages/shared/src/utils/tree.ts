import type { AnyObject, Except, MaybeUndefined, SetRequired } from "../types";

import { isArray, isFunction, isNullish } from "./lib";

/**
 * Options for flattening tree data
 */
export interface FlattenTreeOptions<TNode extends AnyObject = AnyObject, TTransformedNode = FlattenedNode<TNode>> {
  /**
   * The key name for children property
   *
   * @default 'children'
   */
  childrenKey?: keyof TNode;
  /**
   * Whether to include parent node reference
   *
   * @default false
   */
  includeParent?: boolean;
  /**
   * Whether to include level information
   *
   * @default false
   */
  includeLevel?: boolean;
  /**
   * Transform function to convert or filter nodes during flattening
   */
  transform?: (node: TNode, context: { parent?: TNode; level: number }) => TTransformedNode;
  /**
   * Filter function to skip nodes (will still traverse children)
   */
  filter?: (node: TNode, context: { parent?: TNode; level: number }) => boolean;
}

/**
 * Flattened node data (used when transform is not provided)
 */
export interface FlattenedNode<TNode extends AnyObject = AnyObject> {
  /**
   * Original node data
   */
  data: TNode;
  /**
   * Parent node (only exists when includeParent is true)
   */
  parent?: TNode;
  /**
   * Level depth, starting from 0 (only exists when includeLevel is true)
   */
  level?: number;
}

/**
 * Flatten tree data into a one-dimensional array
 *
 * @param tree - Tree data array
 * @param options - Configuration options
 * @returns Flattened array
 */
export function flattenTree<TNode extends AnyObject = AnyObject, TTransformedNode = FlattenedNode<NoInfer<TNode>>>(
  tree: TNode[],
  options: SetRequired<FlattenTreeOptions<NoInfer<TNode>, TTransformedNode>, "includeParent"> | SetRequired<FlattenTreeOptions<NoInfer<TNode>, TTransformedNode>, "includeLevel">
): Array<NoInfer<TTransformedNode>>;

/**
 * Flatten tree data into a one-dimensional array
 *
 * @param tree - Tree data array
 * @param options - Configuration options
 * @returns Flattened array
 */
export function flattenTree<TNode extends AnyObject = AnyObject, TTransformedNode = NoInfer<TNode>>(
  tree: TNode[],
  options?: Except<FlattenTreeOptions<NoInfer<TNode>, TTransformedNode>, "includeParent" | "includeLevel">
): Array<NoInfer<TTransformedNode>>;

/**
 * Flatten tree data into a one-dimensional array
 *
 * @param tree - Tree data array
 * @param options - Configuration options
 * @returns Flattened array
 */
export function flattenTree<TNode extends AnyObject = AnyObject, TTransformedNode = FlattenedNode<NoInfer<TNode>>>(
  tree: TNode[],
  options: FlattenTreeOptions<NoInfer<TNode>, TTransformedNode> = {}
): Array<NoInfer<TTransformedNode>> {
  const {
    childrenKey = "children",
    includeParent = false,
    includeLevel = false,
    transform,
    filter
  } = options;

  const result: TTransformedNode[] = [];

  function traverse(nodes: TNode[], parent?: TNode, level = 0): void {
    if (!isArray(nodes)) {
      return;
    }

    for (const node of nodes) {
      const context = { parent, level };

      if (isFunction(filter) && !filter(node, context)) {
        // Skip current node but continue traversing children
        const children = node[childrenKey];

        if (isArray(children)) {
          traverse(children as TNode[], node, level + 1);
        }

        continue;
      }

      let newNode: TTransformedNode = node;

      if (isFunction(transform)) {
        newNode = transform(node, context);
      } else if (includeParent || includeLevel) {
        const flattenedNode: FlattenedNode<TNode> = { data: node };

        if (includeParent) {
          flattenedNode.parent = parent;
        }

        if (includeLevel) {
          flattenedNode.level = level;
        }

        newNode = flattenedNode as TTransformedNode;
      }

      result.push(newNode);

      const children = node[childrenKey];

      if (isArray(children)) {
        traverse(children as TNode[], node, level + 1);
      }
    }
  }

  traverse(tree);

  return result;
}

/**
 * Key accessor - can be a property name or a getter function
 */
export type KeyAccessor<T extends AnyObject> = keyof T | ((node: T) => unknown);

/**
 * Options for building tree from flat array
 */
export interface BuildTreeOptions<TNode extends AnyObject = AnyObject, TTransformedNode extends AnyObject = TNode, TChildrenKey extends string = "children"> {
  /**
   * Accessor for node id
   * Can be a property name or a getter function
   *
   * @default 'id'
   */
  idKey?: KeyAccessor<TNode>;
  /**
   * Accessor for parent id
   * Can be a property name or a getter function
   *
   * @default 'parentId'
   */
  parentIdKey?: KeyAccessor<TNode>;
  /**
   * The key name for children property
   *
   * @default 'children'
   */
  childrenKey?: TChildrenKey;
  /**
   * Root node condition
   * Can be a value to match against parentId, or a function to determine if a node is root
   */
  rootValue?: TNode[keyof TNode] | ((node: TNode) => boolean);
  /**
   * Transform function to convert nodes during building
   */
  transform?: (node: TNode, context: { children?: TNode[]; level: number }) => TTransformedNode;
}

/**
 * Result node type for buildTree
 */
export type BuildTreeResultNode<TNode extends AnyObject, TChildrenKey extends string> = TNode & {
  [Key in TChildrenKey]?: Array<BuildTreeResultNode<TNode, TChildrenKey>>;
};

/**
 * Get value from node using key accessor
 *
 * @internal
 */
function getNodeValue<T extends AnyObject>(node: T, accessor: KeyAccessor<NoInfer<T>>): unknown {
  if (isFunction(accessor)) {
    return accessor(node);
  }

  const key: string | symbol = typeof accessor === "symbol" ? accessor : String(accessor);
  return Reflect.get(node, key);
}

/**
 * Build tree structure from flat array
 *
 * @param nodes - Flat array of items
 * @param options - Configuration options
 * @returns Tree structure array
 */
export function buildTree<
  TNode extends AnyObject = AnyObject,
  TTransformedNode extends AnyObject = NoInfer<TNode>,
  const TChildrenKey extends string = "children"
>(
  nodes: TNode[],
  options: BuildTreeOptions<NoInfer<TNode>, TTransformedNode, TChildrenKey> = {}
): Array<BuildTreeResultNode<TTransformedNode, TChildrenKey>> {
  const {
    idKey = "id",
    parentIdKey = "parentId",
    childrenKey = "children",
    rootValue,
    transform
  } = options;

  if (!isArray(nodes) || nodes.length === 0) {
    return [];
  }

  const nodeMap = new Map<unknown, TNode>();
  const rootNodes: TNode[] = [];

  for (const node of nodes) {
    const nodeId = getNodeValue(node, idKey);
    nodeMap.set(nodeId, { ...node });
  }

  for (const originalNode of nodes) {
    const nodeId = getNodeValue(originalNode, idKey);
    const parentId = getNodeValue(originalNode, parentIdKey);
    const node = nodeMap.get(nodeId)!;

    const isRoot
      = isFunction(rootValue)
        ? rootValue(originalNode)
        : parentId === rootValue || isNullish(parentId);

    if (isRoot) {
      rootNodes.push(node);
    } else {
      const parentNode = nodeMap.get(parentId);

      if (parentNode) {
        if (!isArray(parentNode[childrenKey])) {
          parentNode[childrenKey] = [] as never;
        }

        parentNode[childrenKey].push(node);
      } else {
        // Parent not found, treat as root node
        rootNodes.push(node);
      }
    }
  }

  if (isFunction(transform)) {
    const transformFn = transform;

    function transformNode(node: TNode, level = 0): TTransformedNode {
      const children = node[childrenKey];
      const transformedNode = transformFn(node, { children, level });

      if (isArray(children)) {
        transformedNode[childrenKey] = children.map((child: TNode) => transformNode(child, level + 1));
      }

      return transformedNode;
    }

    return rootNodes.map(node => transformNode(node));
  }

  return rootNodes;
}

/**
 * Find a node in tree data
 *
 * @param tree - Tree data array
 * @param predicate - Predicate function to find the node
 * @param childrenKey - The key name for children property
 * @returns Found node, or undefined if not found
 */
export function findNodeInTree<TNode extends AnyObject = AnyObject>(
  tree: TNode[],
  predicate: (node: NoInfer<TNode>, context: { parent?: NoInfer<TNode>; level: number }) => boolean,
  childrenKey: keyof NoInfer<TNode> = "children"
): MaybeUndefined<NoInfer<TNode>> {
  function search(nodes: TNode[], parent?: TNode, level = 0): MaybeUndefined<TNode> {
    if (isArray(nodes)) {
      for (const node of nodes) {
        if (predicate(node, { parent, level })) {
          return node;
        }

        const children = node[childrenKey];

        if (isArray(children)) {
          const found = search(children as TNode[], node, level + 1);

          if (found) {
            return found;
          }
        }
      }
    }
  }

  return search(tree);
}

/**
 * Options for traversing tree data
 */
export interface TraverseTreeOptions<TNode extends AnyObject> {
  /**
   * Traversal strategy
   * - 'dfs': Depth-First Search - visit nodes depth-wise (parent -> children -> siblings)
   * - 'bfs': Breadth-First Search - visit nodes level-wise (all nodes at level N before level N+1)
   *
   * @default 'dfs'
   */
  strategy?: "dfs" | "bfs";
  /**
   * The key name for children property
   *
   * @default 'children'
   */
  childrenKey?: keyof TNode;
}

/**
 * Traverse tree data with depth-first or breadth-first strategy
 *
 * @param tree - Tree data array
 * @param callback - Callback function for each node
 * @param options - Traversal options or children key string (for backward compatibility)
 */
export function traverseTree<TNode extends AnyObject = AnyObject>(
  tree: TNode[],
  callback: (node: NoInfer<TNode>, context: { parent?: NoInfer<TNode>; level: number; index: number }) => void,
  options: TraverseTreeOptions<NoInfer<TNode>> = {}
): void {
  const { strategy = "dfs", childrenKey = "children" } = options;

  if (!isArray(tree)) {
    return;
  }

  if (strategy === "bfs") {
    // Breadth-First Search using index-based queue for O(1) dequeue
    interface QueueItem {
      node: TNode;
      parent?: TNode;
      level: number;
      index: number;
    }

    const queue: QueueItem[] = tree.map((node, index) => {
      return {
        node,
        level: 0,
        index
      };
    });

    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const item = queue[queueIndex++]!;
      callback(item.node, {
        parent: item.parent,
        level: item.level,
        index: item.index
      });

      const children = item.node[childrenKey];

      if (isArray(children)) {
        for (const [index, child] of (children as TNode[]).entries()) {
          queue.push({
            node: child,
            parent: item.node,
            level: item.level + 1,
            index
          });
        }
      }
    }
  } else {
    // Depth-First Search using recursion
    function traverse(nodes: TNode[], parent?: TNode, level = 0): void {
      if (!isArray(nodes)) {
        return;
      }

      for (const [index, node] of nodes.entries()) {
        callback(node, {
          parent,
          level,
          index
        });

        const children = node[childrenKey];

        if (isArray(children)) {
          traverse(children as TNode[], node, level + 1);
        }
      }
    }

    traverse(tree);
  }
}

/**
 * Map tree data
 *
 * @param tree - Tree data array
 * @param callback - Mapping callback function
 * @param childrenKey - The key name for children property
 * @returns Mapped tree data
 */
export function mapTree<TNode extends AnyObject = AnyObject, TMappedNode extends AnyObject = AnyObject>(
  tree: TNode[],
  callback: (node: NoInfer<TNode>, context: { parent?: NoInfer<TNode>; level: number; index: number }) => TMappedNode,
  childrenKey: keyof NoInfer<TNode> = "children"
): Array<NoInfer<TMappedNode>> {
  function transform(nodes: TNode[], parent?: TNode, level = 0): TMappedNode[] {
    if (!isArray(nodes)) {
      return [];
    }

    return nodes.map((node, index) => {
      const mappedNode = callback(node, {
        parent,
        level,
        index
      });

      const children = node[childrenKey];

      if (isArray(children)) {
        (mappedNode as AnyObject)[childrenKey] = transform(children as TNode[], node, level + 1);
      }

      return mappedNode;
    });
  }

  return transform(tree);
}

/**
 * Filter tree data
 *
 * @param tree - Tree data array
 * @param predicate - Filter predicate function
 * @param childrenKey - The key name for children property
 * @returns Filtered tree data
 */
export function filterTree<TNode extends AnyObject = AnyObject>(
  tree: TNode[],
  predicate: (node: NoInfer<TNode>, context: { parent?: NoInfer<TNode>; level: number; index: number }) => boolean,
  childrenKey: keyof NoInfer<TNode> = "children"
): Array<NoInfer<TNode>> {
  function filter(nodes: TNode[], parent?: TNode, level = 0): TNode[] {
    if (!isArray(nodes)) {
      return [];
    }

    return nodes.reduce<TNode[]>((acc, node, index) => {
      if (!predicate(node, {
        parent,
        level,
        index
      })) {
        return acc;
      }

      const children = node[childrenKey];
      const newNode = { ...node };

      if (children && isArray(children)) {
        const filteredChildren = filter(children, node, level + 1);

        if (filteredChildren.length > 0) {
          newNode[childrenKey] = filteredChildren as never;
        } else {
          delete newNode[childrenKey];
        }
      }

      acc.push(newNode);
      return acc;
    }, []);
  }

  return filter(tree);
}

/**
 * Filter tree data while preserving ancestor nodes
 *
 * Unlike filterTree, this function keeps all ancestor nodes of matching nodes,
 * even if the ancestors themselves don't match the predicate.
 * This is useful for search/filter scenarios where you want to show the full path to matching nodes.
 *
 * Key behavior:
 * - Non-matching nodes are kept only if they have matching descendants
 * - If a matching node has no matching children, its children are removed
 *
 * @param tree - Tree data array
 * @param predicate - Filter predicate function
 * @param childrenKey - The key name for children property
 * @returns Filtered tree data with preserved ancestor paths
 */
export function filterTreeWithAncestors<TNode extends AnyObject = AnyObject>(
  tree: TNode[],
  predicate: (node: NoInfer<TNode>, context: { parent?: NoInfer<TNode>; level: number; index: number }) => boolean,
  childrenKey: keyof NoInfer<TNode> = "children"
): Array<NoInfer<TNode>> {
  function filter(nodes: TNode[], parent?: TNode, level = 0): TNode[] {
    if (!isArray(nodes)) {
      return [];
    }

    const result: TNode[] = [];

    for (const [index, node] of nodes.entries()) {
      const nodeMatches = predicate(node, {
        parent,
        level,
        index
      });

      const children = node[childrenKey];
      const filteredChildren: TNode[] = isArray(children)
        ? filter(children, node, level + 1)
        : [];

      if (nodeMatches || filteredChildren.length > 0) {
        const newNode = { ...node };

        if (filteredChildren.length > 0) {
          newNode[childrenKey] = filteredChildren as never;
        } else {
          delete newNode[childrenKey];
        }

        result.push(newNode);
      }
    }

    return result;
  }

  return filter(tree);
}
