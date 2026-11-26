import type { Block, FlexNode, GridNode, PresentationLayer, SectionNode, SubformNode, TabsNode, TextfieldField } from "../../types";

import { createDefaultRegistry } from "../registry/defaults";
import {
  collectNodeIds,
  containsNode,
  countFields,
  findField,
  findNode,
  findNodeWithParentContainer,
  findParentContainer,
  findScope,
  isContainerNode,
  isLeafField,
  nodeDefinition,
  nodeDisplayName,
  walkFields,
  walkNodes
} from "./walk";

function tf(id: string, key: string): TextfieldField {
  return {
    id,
    type: "textfield",
    key
  };
}

function schemaOf(...children: Block[]): PresentationLayer {
  return {
    children
  };
}

describe("walk", () => {
  describe("walkFields", () => {
    it("visits every leaf field across containers in order", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("f2", "b")]
      };
      const schema = schemaOf(tf("f1", "a"), section);
      const seen: string[] = [];

      walkFields(schema, field => {
        seen.push(field.id);
      });

      expect(seen).toEqual(["f1", "f2"]);
    });

    it("reports the subform key as the scope of its template fields", () => {
      const subform: SubformNode = {
        id: "sf",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("c1", "amount")]
      };
      const schema = schemaOf(tf("f1", "status"), subform);
      const scopes: Record<string, readonly string[]> = {};

      walkFields(schema, (field, scope) => {
        scopes[field.id] = scope;
      });

      expect(scopes.f1).toEqual([]);
      expect(scopes.c1).toEqual(["lines"]);
    });
  });

  describe("walkNodes", () => {
    it("visits top-level blocks and recurses into containers", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("f2", "b")]
      };
      const schema = schemaOf(tf("f1", "a"), section);
      const ids: string[] = [];

      walkNodes(schema, node => {
        ids.push(id(node.id, node.type));
      });

      expect(ids).toEqual(["f1:textfield", "s1:section", "f2:textfield"]);
    });
  });

  describe("findNode / findField", () => {
    it("finds a node by id at any depth", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("f2", "b")]
      };
      const schema = schemaOf(section);

      expect(findNode(schema, "s1")?.id).toBe("s1");
      expect(findField(schema, "f2")?.id).toBe("f2");
    });

    it("returns undefined from findField for a non-leaf node", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: []
      };
      const schema = schemaOf(section);

      expect(findField(schema, "s1")).toBeUndefined();
    });
  });

  describe("walkNodes through tabs", () => {
    it("visits the tab bodies in tab order before later siblings", () => {
      const tabs: TabsNode = {
        id: "t1",
        type: "tabs",
        tabs: [
          {
            id: "tab1",
            label: "One",
            children: [tf("f1", "a")]
          },
          {
            id: "tab2",
            label: "Two",
            children: [tf("f2", "b")]
          }
        ]
      };
      const schema = schemaOf(tabs, tf("f3", "c"));
      const ids: string[] = [];

      walkNodes(schema, node => {
        ids.push(node.id);
      });

      expect(ids).toEqual(["t1", "f1", "f2", "f3"]);
    });
  });

  describe("findScope", () => {
    it("returns the root scope for a top-level field", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(findScope(schema, "f1")).toEqual([]);
    });

    it("returns the subform-key chain for a template field", () => {
      const subform: SubformNode = {
        id: "sf",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("c1", "amount")]
      };
      const schema = schemaOf(subform);

      expect(findScope(schema, "c1")).toEqual(["lines"]);
    });

    it("returns undefined for an id not in the tree", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(findScope(schema, "missing")).toBeUndefined();
    });
  });

  describe("findParentContainer", () => {
    it("returns undefined for a root-level block", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(findParentContainer(schema, "f1")).toBeUndefined();
    });

    it("returns the grid that directly owns a cell", () => {
      const grid: GridNode = {
        id: "g1",
        type: "grid",
        children: [tf("f1", "a")]
      };
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [grid]
      };
      const schema = schemaOf(section);

      expect(findParentContainer(schema, "f1")?.id).toBe("g1");
    });

    it("returns the tabs node as the parent of a block in any tab body", () => {
      const tabs: TabsNode = {
        id: "t1",
        type: "tabs",
        tabs: [
          {
            id: "tab1",
            label: "One",
            children: []
          },
          {
            id: "tab2",
            label: "Two",
            children: [tf("f2", "b")]
          }
        ]
      };
      const schema = schemaOf(tabs);

      expect(findParentContainer(schema, "f2")?.id).toBe("t1");
    });
  });

  describe("countFields", () => {
    it("counts every leaf field across containers and subform templates", () => {
      const subform: SubformNode = {
        id: "sf",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("c1", "amount"), tf("c2", "note")]
      };
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("f2", "b"), subform]
      };
      const schema = schemaOf(tf("f1", "a"), section);

      expect(countFields(schema)).toBe(4);
    });
  });

  describe("collectNodeIds", () => {
    it("collects the node's own id and every descendant block id", () => {
      const grid: GridNode = {
        id: "g1",
        type: "grid",
        children: [tf("f1", "a")]
      };
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [grid, tf("f2", "b")]
      };

      expect(collectNodeIds(section)).toEqual(new Set(["s1", "g1", "f1", "f2"]));
    });
  });

  describe("containsNode", () => {
    it("is true for the root itself", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: []
      };

      expect(containsNode(section, "s1")).toBe(true);
    });

    it("is true for a nested descendant", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("f1", "a")]
      };

      expect(containsNode(section, "f1")).toBe(true);
    });

    it("is false for an id outside the subtree", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("f1", "a")]
      };

      expect(containsNode(section, "f2")).toBe(false);
    });
  });

  describe("findNodeWithParentContainer", () => {
    it("returns the node with an undefined parent for a root-level block", () => {
      const schema = schemaOf(tf("f1", "a"));
      const located = findNodeWithParentContainer(schema, "f1");

      expect(located?.node.id).toBe("f1");
      expect(located?.parent).toBeUndefined();
    });

    it("returns the owning container as the parent of a nested block", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("f2", "b")]
      };
      const schema = schemaOf(section);
      const located = findNodeWithParentContainer(schema, "f2");

      expect(located?.node.id).toBe("f2");
      expect(located?.parent?.id).toBe("s1");
    });

    it("returns undefined for an id not in the tree", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(findNodeWithParentContainer(schema, "missing")).toBeUndefined();
    });
  });

  describe("node guards", () => {
    it("classifies a container", () => {
      const section: SectionNode = {
        id: "s",
        type: "section",
        variant: "card",
        children: []
      };

      expect(isContainerNode(section)).toBe(true);
    });

    it("classifies a leaf field", () => {
      const section: SectionNode = {
        id: "s",
        type: "section",
        variant: "card",
        children: []
      };

      expect(isLeafField(tf("f", "k"))).toBe(true);
      expect(isLeafField(section)).toBe(false);
    });
  });

  describe("nodeDefinition / nodeDisplayName", () => {
    it("prefers label/title, then key, then registry designer name, then raw type", () => {
      const registry = createDefaultRegistry();

      expect(nodeDisplayName({
        id: "f1",
        type: "textfield",
        key: "userName",
        label: "姓名"
      }, registry)).toBe("姓名");
      expect(nodeDisplayName({
        id: "f2",
        type: "textfield",
        key: "userName"
      }, registry)).toBe("userName");
      expect(nodeDisplayName({
        id: "f3",
        type: "divider"
      }, registry)).toBe("分割线");
      expect(nodeDisplayName({
        id: "f4",
        type: "unknown_widget"
      } as unknown as Block, registry)).toBe("unknown_widget");
    });

    it("resolves container type names from the registry (including 卡片 for untitled sections)", () => {
      const registry = createDefaultRegistry();
      const untitledSection: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: []
      };
      const titledSection: SectionNode = { ...untitledSection, title: "基本信息" };
      const flex: FlexNode = {
        id: "fl1",
        type: "flex",
        children: []
      };
      const grid: GridNode = {
        id: "g1",
        type: "grid",
        children: []
      };
      const tabs: TabsNode = {
        id: "t1",
        type: "tabs",
        tabs: []
      };

      expect(nodeDisplayName(titledSection, registry)).toBe("基本信息");
      expect(nodeDisplayName(untitledSection, registry)).toBe("卡片");
      expect(nodeDisplayName(flex, registry)).toBe("弹性布局");
      expect(nodeDisplayName(grid, registry)).toBe("栅格布局");
      expect(nodeDisplayName(tabs, registry)).toBe("标签页");
    });

    it("resolves a fixed-row subform to the matrix-table preset definition and name", () => {
      const registry = createDefaultRegistry();
      const dynamicSubform: SubformNode = {
        id: "sf1",
        type: "subform",
        variant: "stack",
        key: "",
        template: []
      };
      const fixedSubform: SubformNode = {
        id: "sf2",
        type: "subform",
        variant: "table",
        key: "",
        rows: {
          mode: "fixed",
          itemKey: "item",
          source: { kind: "static", options: [] }
        },
        template: []
      };

      expect(nodeDefinition(dynamicSubform, registry)?.config).toMatchObject({
        name: "子表单",
        icon: "table"
      });
      expect(nodeDisplayName(dynamicSubform, registry)).toBe("子表单");

      expect(nodeDefinition(fixedSubform, registry)?.config).toMatchObject({
        paletteId: "matrix-table",
        name: "矩阵表格",
        icon: "clipboard-list"
      });
      expect(nodeDisplayName(fixedSubform, registry)).toBe("矩阵表格");
      expect(nodeDisplayName({ ...fixedSubform, key: "checklist" }, registry)).toBe("checklist");
      expect(nodeDisplayName({
        ...fixedSubform,
        key: "checklist",
        label: "巡检项"
      }, registry)).toBe("巡检项");
    });
  });
});

function id(value: string, type: string): string {
  return `${value}:${type}`;
}
