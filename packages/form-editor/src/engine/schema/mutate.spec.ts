import type { Block, FlexNode, GridNode, PresentationLayer, SectionNode, SubformNode, TabsNode, TextfieldField } from "../../types";

import { editField, removeBlock, updateNode } from "./mutate";
import { findField, findNode } from "./walk";

function tf(id: string, key: string, extra: Partial<TextfieldField> = {}): TextfieldField {
  return {
    id,
    type: "textfield",
    key,
    ...extra
  };
}

function sectionOf(id: string, children: Block[]): SectionNode {
  return {
    id,
    type: "section",
    variant: "card",
    children
  };
}

function schemaOf(...children: Block[]): PresentationLayer {
  return {
    children
  };
}

describe("mutate (tree)", () => {
  describe("updateNode", () => {
    it("replaces the matching node and leaves siblings untouched", () => {
      const schema = schemaOf(tf("f1", "a"), tf("f2", "b"));

      const next = updateNode(schema, "f2", node => {
        return { ...node, label: "X" };
      });

      expect(findField(next, "f2")?.label).toBe("X");
      expect(findField(next, "f1")?.label).toBeUndefined();
    });

    it("does not mutate the input schema", () => {
      const original = schemaOf(tf("f1", "a"));

      const next = updateNode(original, "f1", node => {
        return { ...node, label: "X" };
      });

      expect(next).not.toBe(original);
      expect(findField(original, "f1")?.label).toBeUndefined();
    });

    it("updates a node nested inside a section", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("f2", "b")]
      };
      const schema = schemaOf(section);

      const next = updateNode(schema, "f2", node => {
        return { ...node, label: "Y" };
      });

      expect(findField(next, "f2")?.label).toBe("Y");
    });
  });

  describe("removeBlock", () => {
    it("removes a leaf field, leaving its siblings", () => {
      const schema = schemaOf(tf("f1", "a"), tf("f2", "b"));

      const next = removeBlock(schema, "f1");

      expect(findNode(next, "f1")).toBeUndefined();
      expect(findField(next, "f2")?.id).toBe("f2");
    });

    it("removes a container and everything beneath it", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("f2", "b")]
      };
      const schema = schemaOf(section, tf("f3", "c"));

      const next = removeBlock(schema, "s1");

      expect(next.children).toHaveLength(1);
      expect(next.children[0]?.id).toBe("f3");
      expect(findNode(next, "f2")).toBeUndefined();
    });

    it("removes a node nested inside a section", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("f2", "b"), tf("f3", "c")]
      };
      const schema = schemaOf(section);

      const next = removeBlock(schema, "f2");

      expect(findNode(next, "f2")).toBeUndefined();
      expect(findField(next, "f3")?.id).toBe("f3");
    });
  });

  describe("updateNode traversal through container bodies", () => {
    it("updates a node nested inside a tab body", () => {
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
      const schema = schemaOf(tabs);

      const next = updateNode(schema, "f2", node => {
        return { ...node, label: "X" };
      });

      expect(findField(next, "f2")?.label).toBe("X");
    });

    it("updates a node nested inside a subform template", () => {
      const subform: SubformNode = {
        id: "sub1",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("f1", "amount")]
      };
      const schema = schemaOf(subform);

      const next = updateNode(schema, "f1", node => {
        return { ...node, label: "X" };
      });

      expect(findField(next, "f1")?.label).toBe("X");
    });

    it("updates a node nested inside a flex body", () => {
      const flex: FlexNode = {
        id: "x1",
        type: "flex",
        children: [tf("f1", "a")]
      };
      const schema = schemaOf(flex);

      const next = updateNode(schema, "f1", node => {
        return { ...node, label: "X" };
      });

      expect(findField(next, "f1")?.label).toBe("X");
    });

    it("updates a node nested inside a grid body", () => {
      const grid: GridNode = {
        id: "g1",
        type: "grid",
        children: [tf("f1", "a")]
      };
      const schema = schemaOf(grid);

      const next = updateNode(schema, "f1", node => {
        return { ...node, label: "X" };
      });

      expect(findField(next, "f1")?.label).toBe("X");
    });
  });

  describe("structural sharing", () => {
    it("keeps an untouched sibling's reference identical through updateNode", () => {
      const untouched = sectionOf("s0", [tf("f0", "z")]);
      const schema = schemaOf(untouched, tf("f1", "a"));

      const next = updateNode(schema, "f1", node => {
        return { ...node, label: "X" };
      });

      expect(next.children[0]).toBe(untouched);
    });

    it("rebuilds only the container chain on the path to the mutation", () => {
      const sibling = tf("f1", "a");
      const inner = tf("f2", "b");
      const wrapper = sectionOf("s1", [sibling, inner]);
      const schema = schemaOf(wrapper);

      const next = updateNode(schema, "f2", node => {
        return { ...node, label: "X" };
      });
      const nextWrapper = next.children[0] as SectionNode;

      expect(nextWrapper).not.toBe(wrapper);
      expect(nextWrapper.children[0]).toBe(sibling);
      expect(nextWrapper.children[1]).not.toBe(inner);
    });

    it("keeps the untouched tab body's reference identical when updating the other tab", () => {
      const untouchedBody = [tf("f1", "a")];
      const tabs: TabsNode = {
        id: "t1",
        type: "tabs",
        tabs: [
          {
            id: "tab1",
            label: "One",
            children: untouchedBody
          },
          {
            id: "tab2",
            label: "Two",
            children: [tf("f2", "b")]
          }
        ]
      };
      const schema = schemaOf(tabs);

      const next = updateNode(schema, "f2", node => {
        return { ...node, label: "X" };
      });
      const nextTabs = next.children[0] as TabsNode;

      expect(nextTabs.tabs[0]?.children).toBe(untouchedBody);
      // The whole untouched TabItem wrapper keeps identity too — memoized tab
      // chrome keys on the wrapper, not only on the body array.
      expect(nextTabs.tabs[0]).toBe(tabs.tabs[0]);
    });

    it("returns the input schema reference when the id is not in the tree", () => {
      const schema = schemaOf(sectionOf("s1", [tf("f1", "a")]));

      const next = updateNode(schema, "missing", node => {
        return { ...node, label: "X" };
      });

      expect(next).toBe(schema);
    });

    it("returns the input schema reference when the updater returns its input", () => {
      const schema = schemaOf(sectionOf("s1", [tf("f1", "a")]));

      expect(updateNode(schema, "f1", node => node)).toBe(schema);
    });

    it("returns the input schema reference when removing a missing id", () => {
      const schema = schemaOf(sectionOf("s1", [tf("f1", "a")]));

      expect(removeBlock(schema, "missing")).toBe(schema);
    });

    it("keeps an untouched sibling's reference identical through removeNode", () => {
      const untouched = sectionOf("s0", [tf("f0", "z")]);
      const schema = schemaOf(untouched, tf("f1", "a"));

      const next = removeBlock(schema, "f1");

      expect(next.children[0]).toBe(untouched);
    });
  });

  describe("editField", () => {
    it("applies the updater only to the matching leaf field", () => {
      const schema = schemaOf(tf("f1", "a"));

      const next = editField(schema, "f1", field => {
        return { ...field, label: "Edited" };
      });

      expect(findField(next, "f1")?.label).toBe("Edited");
    });

    it("ignores a non-field node that shares the id", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: []
      };
      const schema = schemaOf(section);

      const next = editField(schema, "s1", field => {
        return { ...field, label: "should-not-apply" };
      });

      expect(next.children[0]).toMatchObject({ id: "s1", type: "section" });
    });

    it("returns the input schema reference when the id belongs to a container", () => {
      const schema = schemaOf(sectionOf("s1", []));

      const next = editField(schema, "s1", field => {
        return { ...field, label: "should-not-apply" };
      });

      expect(next).toBe(schema);
    });
  });
});
