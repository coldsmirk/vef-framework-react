import { describe, expect, it } from "vitest";

import {
  buildTree,
  filterTree,
  filterTreeWithAncestors,
  findNodeInTree,
  flattenTree,
  mapTree,
  traverseTree
} from "..";

interface TreeNode {
  id: number;
  name: string;
  children?: TreeNode[];
}

interface FlatNode {
  id: number;
  name: string;
  parentId?: number | null;
}

describe("utils/tree", () => {
  const sampleTree: TreeNode[] = [
    {
      id: 1,
      name: "Root 1",
      children: [
        {
          id: 2,
          name: "Child 1.1",
          children: [
            { id: 3, name: "Grandchild 1.1.1" },
            { id: 4, name: "Grandchild 1.1.2" }
          ]
        },
        { id: 5, name: "Child 1.2" }
      ]
    },
    {
      id: 6,
      name: "Root 2",
      children: [{ id: 7, name: "Child 2.1" }]
    },
    { id: 8, name: "Root 3" }
  ];

  const sampleFlatList: FlatNode[] = [
    {
      id: 1,
      name: "Root 1",
      parentId: null
    },
    {
      id: 2,
      name: "Child 1.1",
      parentId: 1
    },
    {
      id: 3,
      name: "Grandchild 1.1.1",
      parentId: 2
    },
    {
      id: 4,
      name: "Grandchild 1.1.2",
      parentId: 2
    },
    {
      id: 5,
      name: "Child 1.2",
      parentId: 1
    },
    {
      id: 6,
      name: "Root 2",
      parentId: null
    },
    {
      id: 7,
      name: "Child 2.1",
      parentId: 6
    },
    {
      id: 8,
      name: "Root 3",
      parentId: null
    }
  ];

  describe("flattenTree", () => {
    it("flattens tree to array", () => {
      const result = flattenTree(sampleTree);

      expect(result).toHaveLength(8);
      expect(result.map(node => node.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("handles empty array", () => {
      const result = flattenTree([]);

      expect(result).toEqual([]);
    });

    it("handles single node without children", () => {
      const tree: TreeNode[] = [{ id: 1, name: "Single" }];
      const result = flattenTree(tree);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 1, name: "Single" });
    });

    it("handles tree with empty children array", () => {
      const tree: TreeNode[] = [
        {
          id: 1,
          name: "Node",
          children: []
        }
      ];
      const result = flattenTree(tree);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        name: "Node",
        children: []
      });
    });

    it("includes level information when includeLevel is true", () => {
      const result = flattenTree(sampleTree, { includeLevel: true });

      expect(result[0]).toHaveProperty("level", 0);
      expect(result[0]?.data.id).toBe(1);
      expect(result[1]).toHaveProperty("level", 1);
      expect(result[1]?.data.id).toBe(2);
      expect(result[2]).toHaveProperty("level", 2);
      expect(result[2]?.data.id).toBe(3);
    });

    it("includes parent reference when includeParent is true", () => {
      const result = flattenTree(sampleTree, { includeParent: true });

      expect(result[0]).toHaveProperty("parent");
      expect(result[0]).toHaveProperty("data");
      expect(result[0]?.data.id).toBe(1);
      expect(result[1]?.parent?.id).toBe(1);
      expect(result[2]?.parent?.id).toBe(2);
    });

    it("includes both parent and level when both options are true", () => {
      const result = flattenTree(sampleTree, {
        includeParent: true,
        includeLevel: true
      });

      expect(result[0]).toHaveProperty("data");
      expect(result[0]).toHaveProperty("level", 0);
      expect(result[0]).toHaveProperty("parent");
      expect(result[1]?.parent?.id).toBe(1);
      expect(result[1]?.level).toBe(1);
    });

    it("supports custom children key", () => {
      interface CustomNode {
        id: number;
        items?: CustomNode[];
      }

      const customTree: CustomNode[] = [
        {
          id: 1,
          items: [{ id: 2 }, { id: 3 }]
        }
      ];

      const result = flattenTree(customTree, { childrenKey: "items" });

      expect(result).toHaveLength(3);
      expect(result.map(node => node.id)).toEqual([1, 2, 3]);
    });

    it("applies transform function", () => {
      const result = flattenTree(sampleTree, {
        transform: (node, { level }) => {
          return {
            id: node.id,
            depth: level,
            title: node.name.toUpperCase()
          };
        }
      });

      expect(result[0]).toEqual({
        id: 1,
        depth: 0,
        title: "ROOT 1"
      });
      expect(result[1]).toEqual({
        id: 2,
        depth: 1,
        title: "CHILD 1.1"
      });
      expect(result[2]).toEqual({
        id: 3,
        depth: 2,
        title: "GRANDCHILD 1.1.1"
      });
    });

    it("applies filter function and skips filtered nodes", () => {
      const result = flattenTree(sampleTree, {
        // Only even IDs
        filter: node => node.id % 2 === 0
      });

      expect(result.map(node => node.id)).toEqual([2, 4, 6, 8]);
    });

    it("filters nodes but still traverses their children", () => {
      const result = flattenTree(sampleTree, {
        // Skip node 2
        filter: node => node.id !== 2
      });

      // Should include 3 and 4 (children of 2) even though 2 is filtered
      expect(result.map(node => node.id)).toEqual([1, 3, 4, 5, 6, 7, 8]);
    });

    it("handles deeply nested tree", () => {
      interface DeepNode {
        id: number;
        children?: DeepNode[];
      }

      const deepTree: DeepNode[] = [
        {
          id: 1,
          children: [
            {
              id: 2,
              children: [
                {
                  id: 3,
                  children: [
                    {
                      id: 4,
                      children: [{ id: 5 }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ];

      const result = flattenTree(deepTree, { includeLevel: true });

      expect(result).toHaveLength(5);
      expect(result[4]?.level).toBe(4);
      expect(result[4]?.data.id).toBe(5);
    });
  });

  describe("buildTree", () => {
    it("builds tree from flat array", () => {
      const result = buildTree(sampleFlatList);

      expect(result).toHaveLength(3);
      expect(result[0]?.id).toBe(1);
      expect(result[0]?.children).toHaveLength(2);
      expect(result[0]?.children?.[0]?.id).toBe(2);
      expect(result[0]?.children?.[0]?.children).toHaveLength(2);
    });

    it("handles empty array", () => {
      const result = buildTree([]);

      expect(result).toEqual([]);
    });

    it("handles flat list with single root node", () => {
      const flatList: FlatNode[] = [
        {
          id: 1,
          name: "Root",
          parentId: null
        }
      ];
      const result = buildTree(flatList);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
    });

    it("handles flat list without any children", () => {
      const flatList: FlatNode[] = [
        {
          id: 1,
          name: "Root 1",
          parentId: null
        },
        {
          id: 2,
          name: "Root 2",
          parentId: null
        },
        {
          id: 3,
          name: "Root 3",
          parentId: null
        }
      ];
      const result = buildTree(flatList);

      expect(result).toHaveLength(3);
      expect(result.every(node => !node?.children)).toBe(true);
    });

    it("supports custom id and parentId keys", () => {
      interface CustomFlatNode {
        key: string;
        parentKey?: string | null;
        title: string;
      }

      const customList: CustomFlatNode[] = [
        {
          key: "a",
          title: "Root",
          parentKey: null
        },
        {
          key: "b",
          title: "Child",
          parentKey: "a"
        }
      ];

      const result = buildTree(customList, {
        idKey: "key",
        parentIdKey: "parentKey"
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.key).toBe("a");
      expect(result[0]?.children?.[0]?.key).toBe("b");
    });

    it("supports custom children key", () => {
      const result = buildTree(sampleFlatList, {
        childrenKey: "items"
      });

      expect(result[0]?.items).toBeDefined();
      expect(result[0]?.items).toHaveLength(2);
    });

    it("supports getter function for id key", () => {
      interface NestedNode {
        data: {
          id: number;
        };
        name: string;
        parentId?: number | null;
      }

      const nestedList: NestedNode[] = [
        {
          data: { id: 1 },
          name: "Root",
          parentId: null
        },
        {
          data: { id: 2 },
          name: "Child",
          parentId: 1
        }
      ];

      const result = buildTree(nestedList, {
        idKey: node => node.data.id
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.data.id).toBe(1);
      expect(result[0]?.children?.[0]?.data.id).toBe(2);
    });

    it("supports getter function for parentId key", () => {
      interface ComplexNode {
        id: number;
        name: string;
        parent?: { id: number };
      }

      const complexList: ComplexNode[] = [
        { id: 1, name: "Root" },
        {
          id: 2,
          name: "Child",
          parent: { id: 1 }
        }
      ];

      const result = buildTree(complexList, {
        parentIdKey: node => node.parent?.id
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.children).toHaveLength(1);
    });

    it("supports custom root value", () => {
      const listWithZeroRoot: FlatNode[] = [
        {
          id: 1,
          name: "Root 1",
          parentId: 0
        },
        {
          id: 2,
          name: "Child 1.1",
          parentId: 1
        },
        {
          id: 3,
          name: "Root 2",
          parentId: 0
        }
      ];

      const result = buildTree(listWithZeroRoot, { rootValue: 0 });

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe(1);
      expect(result[1]?.id).toBe(3);
    });

    it("supports custom root condition function", () => {
      const result = buildTree(sampleFlatList, {
        rootValue: node => !node.parentId || node.parentId === 0
      });

      expect(result).toHaveLength(3);
    });

    it("treats nodes with missing parent as root nodes", () => {
      const listWithMissingParent: FlatNode[] = [
        {
          id: 1,
          name: "Root",
          parentId: null
        },
        {
          id: 2,
          name: "Orphan",
          // Parent doesn't exist
          parentId: 999
        }
      ];

      const result = buildTree(listWithMissingParent);

      expect(result).toHaveLength(2);
      expect(result.find(n => n.id === 2)).toBeDefined();
    });

    it("applies transform function", () => {
      interface TransformedNode {
        key: number;
        label: string;
        depth: number;
        children?: TransformedNode[];
      }

      const result = buildTree<FlatNode, TransformedNode>(sampleFlatList, {
        transform: (node, { level }) => {
          return {
            key: node.id,
            label: node.name.toUpperCase(),
            depth: level
          };
        }
      });

      expect(result[0]?.key).toBe(1);
      expect(result[0]?.label).toBe("ROOT 1");
      expect(result[0]?.depth).toBe(0);
      expect(result[0]?.children?.[0]?.depth).toBe(1);
    });

    it("handles unordered flat list", () => {
      const unorderedList: FlatNode[] = [
        {
          id: 3,
          name: "Grandchild",
          parentId: 2
        },
        {
          id: 1,
          name: "Root",
          parentId: null
        },
        {
          id: 2,
          name: "Child",
          parentId: 1
        }
      ];

      const result = buildTree(unorderedList);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
      expect(result[0]?.children?.[0]?.id).toBe(2);
      expect(result[0]?.children?.[0]?.children?.[0]?.id).toBe(3);
    });

    it("handles circular reference", () => {
      const circularList: FlatNode[] = [
        {
          id: 1,
          name: "Node 1",
          parentId: 2
        },
        {
          id: 2,
          name: "Node 2",
          parentId: 1
        }
      ];

      const result = buildTree(circularList);

      expect(result).toHaveLength(0);
    });
  });

  describe("findNodeInTree", () => {
    it("finds node by predicate", () => {
      const result = findNodeInTree(sampleTree, node => node.id === 3);

      expect(result).toBeDefined();
      expect(result?.id).toBe(3);
      expect(result?.name).toBe("Grandchild 1.1.1");
    });

    it("finds root level node", () => {
      const result = findNodeInTree(sampleTree, node => node.id === 1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });

    it("finds deeply nested node", () => {
      const result = findNodeInTree(sampleTree, node => node.id === 4);

      expect(result).toBeDefined();
      expect(result?.id).toBe(4);
      expect(result?.name).toBe("Grandchild 1.1.2");
    });

    it("returns undefined when node not found", () => {
      const result = findNodeInTree(sampleTree, node => node.id === 999);

      expect(result).toBeUndefined();
    });

    it("provides context to predicate", () => {
      const result = findNodeInTree(
        sampleTree,
        (node, { level }) => node.id === 3 && level === 2
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe(3);
    });

    it("finds first matching node", () => {
      const result = findNodeInTree(sampleTree, node => node.name.startsWith("Child"));

      // First child found
      expect(result?.id).toBe(2);
    });

    it("handles empty tree", () => {
      const result = findNodeInTree([] as TreeNode[], node => node.id === 1);

      expect(result).toBeUndefined();
    });

    it("supports custom children key", () => {
      interface CustomNode {
        id: number;
        items?: CustomNode[];
      }

      const customTree: CustomNode[] = [{ id: 1, items: [{ id: 2 }, { id: 3 }] }];

      const result = findNodeInTree(customTree, node => node.id === 2, "items");

      expect(result).toBeDefined();
      expect(result?.id).toBe(2);
    });

    it("handles tree with undefined children", () => {
      const treeWithUndefined: TreeNode[] = [
        {
          id: 1,
          name: "Node 1",
          children: undefined
        },
        { id: 2, name: "Node 2" }
      ];

      const result = findNodeInTree(treeWithUndefined, node => node.id === 2);

      expect(result?.id).toBe(2);
    });
  });

  describe("traverseTree", () => {
    describe("DFS (Depth-First Search)", () => {
      it("traverses tree in depth-first order", () => {
        const ids: number[] = [];

        traverseTree(sampleTree, node => {
          ids.push(node.id);
        });

        expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      });

      it("provides context to callback", () => {
        const contexts: Array<{ id: number; level: number; index: number }> = [];

        traverseTree(sampleTree, (node, { level, index }) => {
          contexts.push({
            id: node.id,
            level,
            index
          });
        });

        expect(contexts[0]).toEqual({
          id: 1,
          level: 0,
          index: 0
        });
        expect(contexts[1]).toEqual({
          id: 2,
          level: 1,
          index: 0
        });
        expect(contexts[2]).toEqual({
          id: 3,
          level: 2,
          index: 0
        });
      });

      it("provides parent in context", () => {
        let childParent: TreeNode | undefined;

        traverseTree(sampleTree, (node, { parent }) => {
          if (node.id === 2) {
            childParent = parent;
          }
        });

        expect(childParent?.id).toBe(1);
      });

      it("handles empty tree", () => {
        const ids: number[] = [];

        traverseTree([] as TreeNode[], node => {
          ids.push(node.id);
        });

        expect(ids).toEqual([]);
      });
    });

    describe("BFS (Breadth-First Search)", () => {
      it("traverses tree in breadth-first order", () => {
        const ids: number[] = [];

        traverseTree(
          sampleTree,
          node => {
            ids.push(node.id);
          },
          { strategy: "bfs" }
        );

        // Level 0: 1, 6, 8
        // Level 1: 2, 5, 7
        // Level 2: 3, 4
        expect(ids).toEqual([1, 6, 8, 2, 5, 7, 3, 4]);
      });

      it("provides correct level in BFS", () => {
        const levels: number[] = [];

        traverseTree(
          sampleTree,
          (_, { level }) => {
            levels.push(level);
          },
          { strategy: "bfs" }
        );

        expect(levels).toEqual([0, 0, 0, 1, 1, 1, 2, 2]);
      });

      it("provides parent in BFS context", () => {
        const parents: Array<number | undefined> = [];

        traverseTree(
          sampleTree,
          (_, { parent }) => {
            parents.push(parent?.id);
          },
          { strategy: "bfs" }
        );

        // Root has no parent
        expect(parents[0]).toBeUndefined();
        // Node 2's parent is 1
        expect(parents[3]).toBe(1);
        // Node 3's parent is 2
        expect(parents[6]).toBe(2);
      });

      it("handles empty tree in BFS", () => {
        const ids: number[] = [];

        traverseTree(
          [] as TreeNode[],
          node => {
            ids.push(node.id);
          },
          { strategy: "bfs" }
        );

        expect(ids).toEqual([]);
      });
    });

    it("supports custom children key", () => {
      interface CustomNode {
        id: number;
        items?: CustomNode[];
      }

      const customTree: CustomNode[] = [{ id: 1, items: [{ id: 2 }, { id: 3 }] }];

      const ids: number[] = [];

      traverseTree(customTree, node => {
        ids.push(node.id);
      }, { childrenKey: "items" });

      expect(ids).toEqual([1, 2, 3]);
    });

    it("handles single node tree", () => {
      const singleNode: TreeNode[] = [{ id: 1, name: "Single" }];
      const ids: number[] = [];

      traverseTree(singleNode, node => {
        ids.push(node.id);
      });

      expect(ids).toEqual([1]);
    });

    it("handles deeply nested tree", () => {
      interface DeepNode {
        id: number;
        children?: DeepNode[];
      }

      const deepTree: DeepNode[] = [
        {
          id: 1,
          children: [
            {
              id: 2,
              children: [
                {
                  id: 3,
                  children: [{ id: 4 }]
                }
              ]
            }
          ]
        }
      ];

      const ids: number[] = [];

      traverseTree(deepTree, node => {
        ids.push(node.id);
      });

      expect(ids).toEqual([1, 2, 3, 4]);
    });
  });

  describe("mapTree", () => {
    it("maps tree nodes", () => {
      interface MappedNode {
        id: number;
        label: string;
        children?: MappedNode[];
      }

      const result = mapTree(sampleTree, node => {
        const mappedNode: MappedNode = {
          id: node.id,
          label: node.name.toUpperCase()
        };

        return mappedNode;
      });

      expect(result[0]?.label).toBe("ROOT 1");
      expect(result[0]?.children?.[0]?.label).toBe("CHILD 1.1");
      expect(result[0]?.children?.[0]?.children?.[0]?.label).toBe("GRANDCHILD 1.1.1");
    });

    it("preserves tree structure", () => {
      const result = mapTree(sampleTree, node => ({ ...node } as TreeNode));

      expect(result).toHaveLength(3);
      expect(result[0]?.children).toHaveLength(2);
      expect(result[0]?.children?.[0]?.children).toHaveLength(2);
    });

    it("provides context to callback", () => {
      interface MappedNode {
        id: number;
        depth: number;
        children?: MappedNode[];
      }

      const result = mapTree(sampleTree, (node, context) => {
        const resultNode: MappedNode = {
          id: node.id,
          depth: context.level
        };

        return resultNode;
      });

      expect(result[0]?.depth).toBe(0);
      expect(result[0]?.children?.[0]?.depth).toBe(1);
      expect(result[0]?.children?.[0]?.children?.[0]?.depth).toBe(2);
    });

    it("provides parent in context", () => {
      interface MappedNode {
        id: number;
        parentId: number | undefined;
        children?: MappedNode[];
      }

      const result = mapTree<TreeNode, MappedNode>(sampleTree, (node, { parent }) => {
        return {
          id: node.id,
          parentId: parent?.id
        };
      });

      expect(result[0]?.parentId).toBeUndefined();
      expect(result[0]?.children?.[0]?.parentId).toBe(1);
      expect(result[0]?.children?.[0]?.children?.[0]?.parentId).toBe(2);
    });

    it("handles empty tree", () => {
      const result = mapTree([], node => node);

      expect(result).toEqual([]);
    });

    it("supports custom children key", () => {
      interface SourceNode {
        id: number;
        items?: SourceNode[];
      }

      interface TargetNode {
        key: number;
        items?: TargetNode[];
      }

      const sourceTree: SourceNode[] = [{ id: 1, items: [{ id: 2 }] }];

      const result = mapTree<SourceNode, TargetNode>(
        sourceTree,
        node => {
          return { key: node.id };
        },
        "items"
      );

      expect(result[0]?.key).toBe(1);
      expect(result[0]?.items?.[0]?.key).toBe(2);
    });

    it("handles tree without children", () => {
      const flatTree: TreeNode[] = [
        { id: 1, name: "Node 1" },
        { id: 2, name: "Node 2" }
      ];

      const result = mapTree(flatTree, node => {
        return { ...node };
      });

      expect(result).toHaveLength(2);
      expect(result[0]?.children).toBeUndefined();
    });

    it("transforms node types", () => {
      interface NewNode {
        key: string;
        title: string;
        children?: NewNode[];
      }

      const result = mapTree<TreeNode, NewNode>(sampleTree, node => {
        return {
          key: `node-${node.id}`,
          title: node.name
        };
      });

      expect(result[0]?.key).toBe("node-1");
      expect(result[0]?.title).toBe("Root 1");
      expect(result[0]?.children?.[0]?.key).toBe("node-2");
    });
  });

  describe("filterTree", () => {
    it("filters nodes and their subtrees", () => {
      const result = filterTree(sampleTree, node => node.id % 2 === 0);
      const flattened = flattenTree(result);

      expect(flattened.map(n => n.id)).toEqual([6, 8]);
    });

    it("preserves tree structure", () => {
      const result = filterTree(sampleTree, node => node.id !== 5);

      expect(result).toHaveLength(3);
      // Only Child 1.1, not Child 1.2
      expect(result[0]?.children).toHaveLength(1);
      // Both grandchildren
      expect(result[0]?.children?.[0]?.children).toHaveLength(2);
    });

    it("removes nodes without children after filtering", () => {
      const result = filterTree(sampleTree, node => node.id === 1 || node.id === 8);

      expect(result).toHaveLength(2);
      // Children were filtered out
      expect(result[0]?.children).toBeUndefined();
      expect(result[1]?.children).toBeUndefined();
    });

    it("keeps nodes with at least one child passing filter", () => {
      const result = filterTree(sampleTree, node => node.id === 1 || node.id === 2 || node.id === 3);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
      expect(result[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.id).toBe(2);
      expect(result[0]?.children?.[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.children?.[0]?.id).toBe(3);
    });

    it("handles filtering all nodes", () => {
      const result = filterTree(sampleTree, () => false);

      expect(result).toEqual([]);
    });

    it("handles keeping all nodes", () => {
      const result = filterTree(sampleTree, () => true);

      expect(flattenTree(result)).toHaveLength(8);
    });

    it("provides context to predicate", () => {
      const result = filterTree(sampleTree, (_, { level }) => level < 2);

      const flattened = flattenTree(result, { includeLevel: true });

      expect(flattened.every(n => n.level! < 2)).toBe(true);
    });

    it("provides parent in context", () => {
      const result = filterTree(sampleTree, (_, { parent }) => !parent || parent.id === 1);

      // Should keep roots and direct children of node 1
      const ids = flattenTree(result).map(n => n.id);

      expect(ids).toContain(1);
      expect(ids).toContain(6);
      expect(ids).toContain(8);
      expect(ids).toContain(2);
      expect(ids).toContain(5);
      // Grandchild
      expect(ids).not.toContain(3);
    });

    it("handles empty tree", () => {
      const result = filterTree([] as TreeNode[], node => node.id === 1);

      expect(result).toEqual([]);
    });

    it("supports custom children key", () => {
      interface CustomNode {
        id: number;
        items?: CustomNode[];
      }

      const customTree: CustomNode[] = [
        {
          id: 1,
          items: [{ id: 2 }, { id: 3 }]
        }
      ];

      const result = filterTree(customTree, node => node.id !== 2, "items");

      expect(result).toHaveLength(1);
      expect(result[0]?.items).toHaveLength(1);
      expect(result[0]?.items?.[0]?.id).toBe(3);
    });

    it("filters by node name", () => {
      const result = filterTree(sampleTree, node => node.name.includes("Root"));

      expect(result).toHaveLength(3);
      expect(result.every(n => n.name.includes("Root"))).toBe(true);
      expect(result.every(n => !n.children)).toBe(true);
    });

    it("filters nested nodes correctly", () => {
      const result = filterTree(sampleTree, node => node.id === 1 || node.id === 2 || node.id >= 6);

      const flattened = flattenTree(result);
      const ids = flattened.map(n => n.id);

      expect(ids).toEqual([1, 2, 6, 7, 8]);
    });
  });

  describe("integration tests", () => {
    it("converts tree to flat and back to tree", () => {
      const flattened = flattenTree(sampleTree);
      const flatList: FlatNode[] = flattened.map((node, _, arr) => {
        const parent = arr.find(
          n => n.children && (n.children as TreeNode[]).some(c => c.id === node.id)
        );
        return {
          id: node.id,
          name: node.name,
          parentId: parent?.id
        };
      });

      const rebuilt = buildTree(flatList);

      expect(flattenTree(rebuilt).map(n => n.id)).toEqual(
        flattenTree(sampleTree).map(n => n.id)
      );
    });

    it("chains multiple operations", () => {
      const result = filterTree(
        mapTree(sampleTree, node => {
          return {
            ...node,
            name: node.name.toUpperCase()
          };
        }),
        node => !node.name.includes("CHILD 1.2")
      );

      expect(flattenTree(result).map(n => n.id)).toEqual([1, 2, 3, 4, 6, 7, 8]);
      expect(result[0]?.name).toBe("ROOT 1");
    });

    it("traverses filtered tree", () => {
      const filtered = filterTree(sampleTree, node => node.id % 2 === 0);
      const ids: number[] = [];

      traverseTree(filtered, node => {
        ids.push(node.id);
      });

      expect(ids).toEqual([6, 8]);
    });

    it("finds node in mapped tree", () => {
      interface MappedNode {
        key: number;
        label: string;
        children?: MappedNode[];
      }

      const mapped = mapTree<TreeNode, MappedNode>(sampleTree, node => {
        return {
          key: node.id,
          label: node.name
        };
      });

      const found = findNodeInTree(mapped, node => node.key === 3);

      expect(found).toBeDefined();
      expect(found?.label).toBe("Grandchild 1.1.1");
    });
  });

  describe("filterTreeWithAncestors", () => {
    it("preserves ancestor nodes when deep child matches", () => {
      // Match only Grandchild 1.1.1 (id: 3)
      const result = filterTreeWithAncestors(sampleTree, node => node.id === 3);

      // Should keep: Root 1 (1) -> Child 1.1 (2) -> Grandchild 1.1.1 (3)
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
      expect(result[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.id).toBe(2);
      expect(result[0]?.children?.[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.children?.[0]?.id).toBe(3);
    });

    it("filters children even when parent matches", () => {
      // Match Child 1.1 (id: 2) but NOT its children
      const result = filterTreeWithAncestors(sampleTree, node => node.id === 2);

      // Should keep Root 1 -> Child 1.1, but children are removed since they don't match
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
      expect(result[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.id).toBe(2);
      // Children should be removed since they don't match
      expect(result[0]?.children?.[0]?.children).toBeUndefined();
    });

    it("handles multiple matching nodes in different branches", () => {
      // Match Grandchild 1.1.1 (id: 3) and Child 2.1 (id: 7)
      const result = filterTreeWithAncestors(sampleTree, node => node.id === 3 || node.id === 7);

      expect(result).toHaveLength(2);

      // First branch: Root 1 -> Child 1.1 -> Grandchild 1.1.1
      expect(result[0]?.id).toBe(1);
      expect(result[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.id).toBe(2);
      expect(result[0]?.children?.[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.children?.[0]?.id).toBe(3);

      // Second branch: Root 2 -> Child 2.1
      expect(result[1]?.id).toBe(6);
      expect(result[1]?.children).toHaveLength(1);
      expect(result[1]?.children?.[0]?.id).toBe(7);
    });

    it("handles keyword search scenario", () => {
      // User's actual use case: search by keyword
      const keyword = "Grandchild 1.1.2";
      const result = filterTreeWithAncestors(sampleTree, node => node.name.includes(keyword));

      // Should preserve path: Root 1 -> Child 1.1 -> Grandchild 1.1.2
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Root 1");
      expect(result[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.name).toBe("Child 1.1");
      expect(result[0]?.children?.[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.children?.[0]?.name).toBe("Grandchild 1.1.2");
    });

    it("handles partial keyword matching", () => {
      // Search for nodes containing 'Child' (case-sensitive)
      // Note: "Grandchild" contains lowercase "child", not "Child"
      const result = filterTreeWithAncestors(sampleTree, node => node.name.includes("Child"));

      const flattened = flattenTree(result);
      const ids = flattened.map(n => n.id);

      // Should include: Root 1, Child 1.1 (matches but children removed), Child 1.2, Root 2, Child 2.1
      // Root 1 (ancestor, preserved for path)
      expect(ids).toContain(1);
      // Child 1.1 (matches, but grandchildren don't match "Child")
      expect(ids).toContain(2);
      // Child 1.2 (matches)
      expect(ids).toContain(5);
      // Root 2 (ancestor, preserved for path)
      expect(ids).toContain(6);
      // Child 2.1 (matches)
      expect(ids).toContain(7);
      // Grandchildren don't match because they contain lowercase "child"
      expect(ids).not.toContain(3);
      expect(ids).not.toContain(4);
      // Root 3 (no matching descendants)
      expect(ids).not.toContain(8);
    });

    it("returns empty array when no matches", () => {
      const result = filterTreeWithAncestors(sampleTree, () => false);

      expect(result).toEqual([]);
    });

    it("keeps entire tree when all nodes match", () => {
      const result = filterTreeWithAncestors(sampleTree, () => true);

      expect(flattenTree(result)).toHaveLength(8);
    });

    it("handles empty tree", () => {
      const result = filterTreeWithAncestors([] as TreeNode[], node => node.id === 1);

      expect(result).toEqual([]);
    });

    it("handles tree with single node", () => {
      const singleNode: TreeNode[] = [{ id: 1, name: "Single" }];

      // Matching
      const resultMatch = filterTreeWithAncestors(singleNode, node => node.id === 1);

      expect(resultMatch).toHaveLength(1);
      expect(resultMatch[0]?.id).toBe(1);

      // Not matching
      const resultNoMatch = filterTreeWithAncestors(singleNode, node => node.id === 999);

      expect(resultNoMatch).toEqual([]);
    });

    it("supports custom children key", () => {
      interface CustomNode {
        id: number;
        items?: CustomNode[];
      }

      const customTree: CustomNode[] = [
        {
          id: 1,
          items: [
            {
              id: 2,
              items: [{ id: 3 }]
            }
          ]
        }
      ];

      const result = filterTreeWithAncestors(customTree, node => node.id === 3, "items");

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
      expect(result[0]?.items).toHaveLength(1);
      expect(result[0]?.items?.[0]?.id).toBe(2);
      expect(result[0]?.items?.[0]?.items).toHaveLength(1);
      expect(result[0]?.items?.[0]?.items?.[0]?.id).toBe(3);
    });

    it("provides correct context to predicate", () => {
      const contexts: Array<{
        id: number;
        level: number;
        hasParent: boolean;
      }> = [];

      filterTreeWithAncestors(sampleTree, (node, { parent, level }) => {
        contexts.push({
          id: node.id,
          level,
          hasParent: !!parent
        });

        return node.id === 3;
      });

      // Root nodes should have level 0 and no parent
      const rootContext = contexts.find(c => c.id === 1);

      expect(rootContext?.level).toBe(0);
      expect(rootContext?.hasParent).toBe(false);

      // Child nodes should have parent
      const childContext = contexts.find(c => c.id === 2);

      expect(childContext?.level).toBe(1);
      expect(childContext?.hasParent).toBe(true);

      // Grandchild nodes should have correct level
      const grandchildContext = contexts.find(c => c.id === 3);

      expect(grandchildContext?.level).toBe(2);
      expect(grandchildContext?.hasParent).toBe(true);
    });

    it("always recurses into children even when parent matches", () => {
      let callCount = 0;
      const result = filterTreeWithAncestors(sampleTree, node => {
        callCount++;
        return node.id === 2;
      });

      // Should call predicate for ALL nodes in the tree:
      // - All root nodes (1, 6, 8)
      // - Child 1.1 (2) - matches, but still recurses
      // - Grandchild 1.1.1 (3) and Grandchild 1.1.2 (4)
      // - Child 1.2 (5)
      // - Child 2.1 (7)
      expect(callCount).toBe(8);

      // Matched node should NOT keep non-matching descendants
      expect(result[0]?.children?.[0]?.children).toBeUndefined();
    });

    it("filters siblings correctly", () => {
      // Match only one sibling
      const result = filterTreeWithAncestors(sampleTree, node => node.id === 5);

      // Should keep: Root 1 -> Child 1.2
      // Should NOT keep: Child 1.1 and its children
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
      expect(result[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.id).toBe(5);
      expect(result[0]?.children?.[0]?.children).toBeUndefined();
    });

    it("handles multiple matches at same level", () => {
      // Match both children of Root 1
      const result = filterTreeWithAncestors(sampleTree, node => node.id === 2 || node.id === 5);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
      expect(result[0]?.children).toHaveLength(2);
      expect(result[0]?.children?.map(c => c.id)).toEqual([2, 5]);

      // Child 1.1's descendants don't match, so they should be removed
      expect(result[0]?.children?.[0]?.children).toBeUndefined();
      // Child 1.2 has no children
      expect(result[0]?.children?.[1]?.children).toBeUndefined();
    });

    it("preserves original node structure", () => {
      const result = filterTreeWithAncestors(sampleTree, node => node.id === 3);

      // Check that original properties are preserved
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("children");
      expect(result[0]?.name).toBe("Root 1");
    });

    it("works with real-world search scenario", () => {
      // Simulating a department/employee tree search
      interface Employee {
        id: number;
        name: string;
        department: string;
        children?: Employee[];
      }

      const orgTree: Employee[] = [
        {
          id: 1,
          name: "CEO",
          department: "Executive",
          children: [
            {
              id: 2,
              name: "CTO",
              department: "Technology",
              children: [
                {
                  id: 3,
                  name: "Tech Lead",
                  department: "Engineering"
                },
                {
                  id: 4,
                  name: "John Doe",
                  department: "Engineering"
                }
              ]
            },
            {
              id: 5,
              name: "CFO",
              department: "Finance"
            }
          ]
        }
      ];

      // Search for "John" - should return path from CEO to John
      const result = filterTreeWithAncestors(orgTree, emp => emp.name.includes("John"));

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("CEO");
      expect(result[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.name).toBe("CTO");
      expect(result[0]?.children?.[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.children?.[0]?.name).toBe("John Doe");
    });
  });
});
