import type {
  Block,
  FlexNode,
  GridNode,
  PresentationLayer,
  SectionNode,
  SelectField,
  StaticOptionSource,
  SubformNode,
  TabsNode,
  TextfieldField
} from "../../types";

import { cloneBlock, insertBlock, moveBlock, setColumnWidth, setFlex, setSpan, targetScope } from "./edit-ops";
import { collectNodeIds, findField, findNode } from "./walk";

function tf(id: string, key: string): TextfieldField {
  return {
    id,
    type: "textfield",
    key
  };
}

function tabsOf(id: string, bodies: Block[][]): TabsNode {
  return {
    id,
    type: "tabs",
    tabs: bodies.map((children, index) => {
      return {
        id: `${id}_tab${index + 1}`,
        label: `Tab ${index + 1}`,
        children
      };
    })
  };
}

function schemaOf(...children: Block[]): PresentationLayer {
  return {
    children
  };
}

function keyOf(schema: PresentationLayer, fieldId: string): string | undefined {
  const field = findField(schema, fieldId);

  return field && "key" in field ? field.key : undefined;
}

describe("edit-ops", () => {
  describe("insertBlock", () => {
    it("appends a new block at the end of the form", () => {
      const schema = schemaOf(tf("f1", "a"));

      const next = insertBlock(schema, tf("f2", "b"), { kind: "append" });

      expect(next.children).toHaveLength(2);
      expect(findField(next, "f2")?.id).toBe("f2");
    });

    it("drops a block after an anchor, sharing its parent list and leaving it auto", () => {
      const schema = schemaOf(tf("f1", "a"));

      const next = insertBlock(schema, tf("f2", "b"), {
        kind: "beside",
        anchorId: "f1",
        side: "after"
      });

      expect(next.children.map(block => block.id)).toEqual(["f1", "f2"]);
      // The insert writes no explicit span — the block stays auto, so a sibling's
      // manually-set width would survive inside a grid.
      expect(next.children.map(block => block.span)).toEqual([undefined, undefined]);
    });

    it("drops a block before an anchor", () => {
      const schema = schemaOf(tf("f1", "a"));

      const next = insertBlock(schema, tf("f2", "b"), {
        kind: "beside",
        anchorId: "f1",
        side: "before"
      });

      expect(next.children.map(block => block.id)).toEqual(["f2", "f1"]);
    });

    it("appends a block into a section container", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: []
      };
      const schema = schemaOf(section);

      const next = insertBlock(schema, tf("f2", "b"), { kind: "container", containerId: "s1" });
      const container = findNode(next, "s1");

      expect(container?.type).toBe("section");
      expect(findField(next, "f2")?.id).toBe("f2");
    });
  });

  describe("insertBlock into tabs", () => {
    it("appends into the tab selected by tabIndex", () => {
      const tabs = tabsOf("t1", [[tf("f1", "a")], [tf("f2", "b")]]);
      const schema = schemaOf(tabs);

      const next = insertBlock(schema, tf("f3", "c"), {
        kind: "container",
        containerId: "t1",
        tabIndex: 1
      });
      const nextTabs = next.children[0] as TabsNode;

      expect(nextTabs.tabs[1]?.children.map(block => block.id)).toEqual(["f2", "f3"]);
      expect(nextTabs.tabs[0]?.children.map(block => block.id)).toEqual(["f1"]);
    });

    it("clamps an out-of-range tabIndex to the last tab", () => {
      const tabs = tabsOf("t1", [[tf("f1", "a")], [tf("f2", "b")]]);
      const schema = schemaOf(tabs);

      const next = insertBlock(schema, tf("f3", "c"), {
        kind: "container",
        containerId: "t1",
        tabIndex: 9
      });
      const nextTabs = next.children[0] as TabsNode;

      expect(nextTabs.tabs[1]?.children.map(block => block.id)).toEqual(["f2", "f3"]);
    });

    it("clamps a negative tabIndex to the first tab", () => {
      const tabs = tabsOf("t1", [[tf("f1", "a")], [tf("f2", "b")]]);
      const schema = schemaOf(tabs);

      const next = insertBlock(schema, tf("f3", "c"), {
        kind: "container",
        containerId: "t1",
        tabIndex: -1
      });
      const nextTabs = next.children[0] as TabsNode;

      expect(nextTabs.tabs[0]?.children.map(block => block.id)).toEqual(["f1", "f3"]);
    });
  });

  describe("insertBlock identity (structural sharing)", () => {
    it("returns the input layer reference when the beside anchor is stale", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(insertBlock(schema, tf("f2", "b"), {
        kind: "beside",
        anchorId: "missing",
        side: "after"
      })).toBe(schema);
    });

    it("returns the input layer reference when the container target is missing", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(insertBlock(schema, tf("f2", "b"), { kind: "container", containerId: "missing" })).toBe(schema);
    });

    it("returns the input layer reference when the container id belongs to a leaf field", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(insertBlock(schema, tf("f2", "b"), { kind: "container", containerId: "f1" })).toBe(schema);
    });

    it("keeps untouched siblings' references identical when dropping into a nested grid body", () => {
      const untouched: SectionNode = {
        id: "s0",
        type: "section",
        variant: "card",
        children: [tf("f0", "z")]
      };
      const grid: GridNode = {
        id: "g1",
        type: "grid",
        children: [tf("f1", "a")]
      };
      const wrapper: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [grid]
      };
      const schema = schemaOf(untouched, wrapper);

      const next = insertBlock(schema, tf("f2", "b"), {
        kind: "beside",
        anchorId: "f1",
        side: "after"
      });

      expect(next.children[0]).toBe(untouched);
      expect(next.children[1]).not.toBe(wrapper);
    });

    it("keeps the untouched tab body's reference identical when appending into the other tab", () => {
      const untouchedBody = [tf("f1", "a")];
      const tabs = tabsOf("t1", [untouchedBody, [tf("f2", "b")]]);
      const schema = schemaOf(tabs);

      const next = insertBlock(schema, tf("f3", "c"), {
        kind: "container",
        containerId: "t1",
        tabIndex: 1
      });
      const nextTabs = next.children[0] as TabsNode;

      expect(nextTabs.tabs[0]?.children).toBe(untouchedBody);
    });

    it("keeps the untouched subform template's reference identical when inserting elsewhere", () => {
      const untouched: SubformNode = {
        id: "sub1",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("inner", "amount")]
      };
      const schema = schemaOf(untouched, tf("f1", "a"));

      const next = insertBlock(schema, tf("f2", "b"), {
        kind: "beside",
        anchorId: "f1",
        side: "after"
      });

      expect(next.children[0]).toBe(untouched);
    });
  });

  describe("moveBlock", () => {
    it("moves a block to sit immediately after another", () => {
      const schema = schemaOf(tf("f1", "a"), tf("f2", "b"), tf("f3", "c"));

      const next = moveBlock(schema, "f3", {
        kind: "beside",
        anchorId: "f1",
        side: "after"
      });

      expect(next.children.map(block => block.id)).toEqual(["f1", "f3", "f2"]);
    });

    it("is a no-op when dropping a block onto itself", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(moveBlock(schema, "f1", {
        kind: "beside",
        anchorId: "f1",
        side: "after"
      })).toBe(schema);
    });

    it("is a no-op when dropping a container into its own descendant", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("inner", "b")]
      };
      const schema = schemaOf(section);

      const intoSelf = moveBlock(schema, "s1", { kind: "container", containerId: "s1" });
      const besideChild = moveBlock(schema, "s1", {
        kind: "beside",
        anchorId: "inner",
        side: "after"
      });

      expect(intoSelf).toBe(schema);
      expect(besideChild).toBe(schema);
    });

    it("does not delete the dragged container when the drop is inside it", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("inner", "b")]
      };
      const schema = schemaOf(section);

      const next = moveBlock(schema, "s1", { kind: "container", containerId: "s1" });

      expect(findNode(next, "s1")).toBeDefined();
      expect(findField(next, "inner")).toBeDefined();
    });

    it("rolls back to the original schema when the drop target anchor does not exist", () => {
      const schema = schemaOf(tf("f1", "a"), tf("f2", "b"));

      const next = moveBlock(schema, "f1", {
        kind: "beside",
        anchorId: "missing",
        side: "after"
      });

      expect(next).toBe(schema);
      expect(findField(next, "f1")).toBeDefined();
    });
  });

  describe("moveBlock into a container target", () => {
    it("moves a root block into a section body", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: []
      };
      const schema = schemaOf(tf("f1", "a"), section);

      const next = moveBlock(schema, "f1", { kind: "container", containerId: "s1" });
      const nextSection = next.children[0] as SectionNode;

      expect(next.children.map(block => block.id)).toEqual(["s1"]);
      expect(nextSection.children.map(block => block.id)).toEqual(["f1"]);
    });

    it("re-keys a block moved into a subform container target", () => {
      const subform: SubformNode = {
        id: "sub1",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("inner", "amount")]
      };
      const schema = schemaOf(tf("root", "amount"), subform);

      const next = moveBlock(schema, "root", { kind: "container", containerId: "sub1" });
      const nextSubform = next.children[0] as SubformNode;

      expect(nextSubform.template.map(block => block.id)).toEqual(["inner", "root"]);
      expect(keyOf(next, "root")).toBe("amount_2");
    });

    it("keeps an untouched sibling container's reference identical across a move", () => {
      const untouched: SectionNode = {
        id: "s0",
        type: "section",
        variant: "card",
        children: [tf("f0", "z")]
      };
      const target: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: []
      };
      const schema = schemaOf(untouched, tf("f1", "a"), target);

      const next = moveBlock(schema, "f1", { kind: "container", containerId: "s1" });

      expect(next.children[0]).toBe(untouched);
    });
  });

  describe("moveBlock across value scopes", () => {
    it("re-keys a root field moved into a subform so its key stays unique in the new scope", () => {
      const subform: SubformNode = {
        id: "sub1",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("inner", "amount")]
      };
      const schema = schemaOf(tf("root", "amount"), subform);

      const next = moveBlock(schema, "root", {
        kind: "beside",
        anchorId: "inner",
        side: "after"
      });

      expect(keyOf(next, "root")).toBe("amount_2");
      expect(keyOf(next, "inner")).toBe("amount");
    });

    it("keeps the key unchanged for a move within the same scope", () => {
      const schema = schemaOf(tf("f1", "a"), tf("f2", "b"));

      const next = moveBlock(schema, "f2", {
        kind: "beside",
        anchorId: "f1",
        side: "after"
      });

      expect(keyOf(next, "f2")).toBe("b");
    });

    it("preserves linkage rule ids while re-keying a cross-scope move", () => {
      const field = tf("root", "amount");

      field.linkage = {
        rules: [
          {
            id: "Rule_keep",
            trigger: {
              kind: "condition",
              condition: {
                kind: "leaf",
                sourceKey: "x",
                operator: "eq",
                value: 1
              }
            },
            actions: [{ type: "hide" }]
          }
        ]
      };

      const subform: SubformNode = {
        id: "sub1",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("inner", "amount")]
      };
      const schema = schemaOf(field, subform);

      const next = moveBlock(schema, "root", {
        kind: "beside",
        anchorId: "inner",
        side: "after"
      });

      expect(keyOf(next, "root")).toBe("amount_2");
      expect(findField(next, "root")?.linkage?.rules?.[0]?.id).toBe("Rule_keep");
    });
  });

  describe("targetScope", () => {
    it("returns the root scope for an append", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(targetScope(schema, { kind: "append" })).toEqual([]);
    });

    it("returns the subform scope when dropping into a subform body", () => {
      const subform: SubformNode = {
        id: "sub1",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("inner", "amount")]
      };
      const schema = schemaOf(subform);

      expect(targetScope(schema, { kind: "container", containerId: "sub1" })).toEqual(["lines"]);
      expect(targetScope(schema, {
        kind: "beside",
        anchorId: "inner",
        side: "after"
      })).toEqual(["lines"]);
    });
  });

  describe("cloneBlock", () => {
    it("mints a fresh id and key for a leaf field", () => {
      const clone = cloneBlock(tf("f1", "amount"), base => `${base}_copy`) as TextfieldField;

      expect(clone.id).not.toBe("f1");
      expect(clone.key).toBe("amount_copy");
    });

    it("deep-clones linkage with fresh rule ids so source and clone never share rules", () => {
      const source = tf("f1", "a");
      source.linkage = {
        rules: [
          {
            id: "Rule_1",
            trigger: {
              kind: "condition",
              condition: {
                kind: "leaf",
                sourceKey: "x",
                operator: "eq",
                value: 1
              }
            },
            actions: [{ type: "hide" }]
          }
        ]
      };

      const clone = cloneBlock(source, base => base);

      expect(clone.linkage).not.toBe(source.linkage);
      expect(clone.linkage?.rules?.[0]).not.toBe(source.linkage?.rules?.[0]);
      expect(clone.linkage?.rules?.[0]?.id).not.toBe("Rule_1");
    });

    it("preserves inner template keys when cloning a subform (a new value scope)", () => {
      const subform: SubformNode = {
        id: "sub1",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("inner", "amount")]
      };

      const clone = cloneBlock(subform, base => `${base}_copy`) as SubformNode;
      const innerField = clone.template[0] as TextfieldField;

      expect(clone.key).toBe("lines_copy");
      expect(innerField.key).toBe("amount");
      expect(innerField.id).not.toBe("inner");
    });

    it("shares no node id between a clone and its source", () => {
      const subform: SubformNode = {
        id: "sub1",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [tf("inner", "amount")]
      };

      const clone = cloneBlock(subform, base => `${base}_copy`);
      const sourceIds = collectNodeIds(subform);

      for (const id of collectNodeIds(clone)) {
        expect(sourceIds.has(id)).toBe(false);
      }
    });

    it("remaps internal linkage source keys so a cloned container's links follow the new keys", () => {
      const a = tf("fa", "a");
      const b = tf("fb", "b");

      b.linkage = {
        rules: [
          {
            id: "Rule_1",
            trigger: {
              kind: "condition",
              condition: {
                kind: "leaf",
                sourceKey: "a",
                operator: "eq",
                value: 1
              }
            },
            actions: [{ type: "hide" }]
          }
        ]
      };

      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [a, b]
      };

      const clone = cloneBlock(section, base => `${base}_2`) as SectionNode;
      const clonedA = clone.children[0] as TextfieldField;
      const clonedB = clone.children[1] as TextfieldField;

      expect(clonedA.key).toBe("a_2");
      expect(clonedB.key).toBe("b_2");
      expect(clonedB.linkage?.rules?.[0]?.trigger).toMatchObject({
        kind: "condition",
        condition: { kind: "leaf", sourceKey: "a_2" }
      });
    });

    it("leaves a linkage reference to a field outside the cloned subtree untouched", () => {
      const b = tf("fb", "b");

      b.linkage = {
        rules: [
          {
            id: "Rule_1",
            trigger: {
              kind: "condition",
              condition: {
                kind: "leaf",
                sourceKey: "external",
                operator: "eq",
                value: 1
              }
            },
            actions: [{ type: "hide" }]
          }
        ]
      };

      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [b]
      };

      const clone = cloneBlock(section, base => `${base}_2`) as SectionNode;
      const clonedB = clone.children[0] as TextfieldField;

      expect(clonedB.linkage?.rules?.[0]?.trigger).toMatchObject({
        kind: "condition",
        condition: { kind: "leaf", sourceKey: "external" }
      });
    });
  });

  describe("setSpan", () => {
    it("sets a block's column span", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(findField(setSpan(schema, "f1", 8), "f1")?.span).toBe(8);
    });

    it("clamps a span above the column basis down to 24", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(findField(setSpan(schema, "f1", 99), "f1")?.span).toBe(24);
    });

    it("clamps a span below 1 up to 1", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(findField(setSpan(schema, "f1", 0), "f1")?.span).toBe(1);
    });

    it("floors a fractional span to an integer", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(findField(setSpan(schema, "f1", 8.7), "f1")?.span).toBe(8);
    });

    it("clears the span back to auto with undefined", () => {
      const schema = setSpan(schemaOf(tf("f1", "a")), "f1", 8);

      expect(findField(setSpan(schema, "f1", undefined), "f1")?.span).toBeUndefined();
    });

    it("returns the input layer reference when writing the span already in place", () => {
      const schema = setSpan(schemaOf(tf("f1", "a")), "f1", 8);

      expect(setSpan(schema, "f1", 8)).toBe(schema);
    });

    it("returns the input layer reference for a missing block id", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(setSpan(schema, "missing", 8)).toBe(schema);
    });
  });

  describe("setFlex", () => {
    it("sets per-slot flex sizing on a block", () => {
      const schema = schemaOf(tf("f1", "a"));

      const next = setFlex(schema, "f1", { grow: 1, basis: "200px" });

      expect(findField(next, "f1")?.flex).toEqual({ grow: 1, basis: "200px" });
    });

    it("clamps negative grow and shrink factors to zero", () => {
      const schema = schemaOf(tf("f1", "a"));

      const next = setFlex(schema, "f1", { grow: -1, shrink: -2 });

      expect(findField(next, "f1")?.flex).toEqual({ grow: 0, shrink: 0 });
    });

    it("drops a non-finite factor from the written slot", () => {
      const schema = schemaOf(tf("f1", "a"));

      const next = setFlex(schema, "f1", { grow: NaN, basis: "1px" });

      expect(findField(next, "f1")?.flex).toEqual({ basis: "1px" });
    });

    it("clears the slot entirely when every axis is dropped as invalid", () => {
      // `{ grow: NaN }` must not persist as `flex: {}` — an all-invalid write
      // collapses to "no flex config", like clampSpan/clampColumnWidth.
      const schema = setFlex(schemaOf(tf("f1", "a")), "f1", { grow: 1 });

      expect(findField(setFlex(schema, "f1", { grow: NaN }), "f1")?.flex).toBeUndefined();
    });

    it("clears the flex slot with undefined", () => {
      const schema = setFlex(schemaOf(tf("f1", "a")), "f1", { grow: 1 });

      expect(findField(setFlex(schema, "f1", undefined), "f1")?.flex).toBeUndefined();
    });

    it("returns the input layer reference when writing a slot equal to the one in place", () => {
      const schema = setFlex(schemaOf(tf("f1", "a")), "f1", { grow: 1, basis: "10%" });

      expect(setFlex(schema, "f1", { grow: 1, basis: "10%" })).toBe(schema);
    });
  });

  describe("setColumnWidth", () => {
    it("sets a block's fixed column width", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(findField(setColumnWidth(schema, "f1", 200), "f1")?.columnWidth).toBe(200);
    });

    it("clamps a width below 1 up to 1", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(findField(setColumnWidth(schema, "f1", 0), "f1")?.columnWidth).toBe(1);
    });

    it("floors a fractional width to an integer", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(findField(setColumnWidth(schema, "f1", 120.8), "f1")?.columnWidth).toBe(120);
    });

    it("clears the width back to auto with undefined", () => {
      const schema = setColumnWidth(schemaOf(tf("f1", "a")), "f1", 200);

      expect(findField(setColumnWidth(schema, "f1", undefined), "f1")?.columnWidth).toBeUndefined();
    });

    it("clears the width back to auto for a non-finite number", () => {
      const schema = setColumnWidth(schemaOf(tf("f1", "a")), "f1", 200);

      expect(findField(setColumnWidth(schema, "f1", NaN), "f1")?.columnWidth).toBeUndefined();
    });

    it("returns the input layer reference when writing the width already in place", () => {
      const schema = setColumnWidth(schemaOf(tf("f1", "a")), "f1", 200);

      expect(setColumnWidth(schema, "f1", 200)).toBe(schema);
    });

    it("returns the input layer reference for a missing block id", () => {
      const schema = schemaOf(tf("f1", "a"));

      expect(setColumnWidth(schema, "missing", 200)).toBe(schema);
    });
  });

  describe("cloneBlock with a flex container", () => {
    it("recurses into the flex body, minting fresh ids and re-keyed children", () => {
      const flex: FlexNode = {
        id: "Flex_1",
        type: "flex",
        direction: "row",
        children: [tf("ff1", "amount")]
      };

      const clone = cloneBlock(flex, base => `${base}_2`) as FlexNode;
      const [clonedField] = clone.children;

      expect(clone.type).toBe("flex");
      expect(clone.id).not.toBe("Flex_1");
      expect(clone.children).toHaveLength(1);
      expect(clonedField?.id).not.toBe("ff1");
      expect(keyOf(schemaOf(clone), clonedField?.id ?? "")).toBe("amount_2");
    });
  });

  describe("cloneBlock with a grid container", () => {
    it("recurses into the grid body, minting fresh ids and re-keyed cells", () => {
      const grid: GridNode = {
        id: "Grid_1",
        type: "grid",
        columns: 2,
        children: [tf("gf1", "amount")]
      };

      const clone = cloneBlock(grid, base => `${base}_2`) as GridNode;
      const [clonedCell] = clone.children;

      expect(clone.type).toBe("grid");
      expect(clone.columns).toBe(2);
      expect(clone.id).not.toBe("Grid_1");
      expect(clone.children).toHaveLength(1);
      expect(clonedCell?.id).not.toBe("gf1");
      expect(keyOf(schemaOf(clone), clonedCell?.id ?? "")).toBe("amount_2");
    });
  });

  describe("cloneBlock with a tabs container", () => {
    it("mints fresh tab ids and recurses each tab body", () => {
      const tabs = tabsOf("t1", [[tf("f1", "a")], [tf("f2", "b")]]);

      const clone = cloneBlock(tabs, base => `${base}_2`) as TabsNode;

      expect(clone.id).not.toBe("t1");
      expect(clone.tabs.map(tab => tab.id)).not.toContain("t1_tab1");
      expect(clone.tabs.map(tab => tab.id)).not.toContain("t1_tab2");
      expect(clone.tabs[0]?.label).toBe("Tab 1");
      expect(clone.tabs[0]?.children[0]?.id).not.toBe("f1");
      expect(keyOf(schemaOf(clone), clone.tabs[1]?.children[0]?.id ?? "")).toBe("b_2");
    });
  });

  describe("cloneBlock in keep-keys mode", () => {
    it("preserves keys verbatim while minting fresh node ids", () => {
      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [tf("f1", "amount"), tf("f2", "status")]
      };

      const clone = cloneBlock(section, null) as SectionNode;
      const keys = clone.children.map(child => child.type === "textfield" ? child.key : undefined);

      expect(clone.id).not.toBe("s1");
      expect(clone.children.map(child => child.id)).not.toContain("f1");
      expect(keys).toEqual(["amount", "status"]);
    });

    it("mints fresh linkage rule ids even when keys are preserved", () => {
      const field = tf("f1", "a");

      field.linkage = {
        rules: [
          {
            id: "Rule_1",
            trigger: { kind: "change" },
            actions: [{ type: "hide" }]
          }
        ]
      };

      const clone = cloneBlock(field, null);

      expect(clone.linkage?.rules?.[0]?.id).not.toBe("Rule_1");
    });
  });

  describe("cloneBlock linkage key remap", () => {
    it("remaps a set_field action's targetKey to the reallocated key", () => {
      const a = tf("fa", "a");
      const b = tf("fb", "b");

      b.linkage = {
        rules: [
          {
            id: "Rule_1",
            trigger: { kind: "change" },
            actions: [
              {
                type: "set_field",
                targetKey: "a",
                value: { kind: "literal", value: 1 }
              }
            ]
          }
        ]
      };

      const section: SectionNode = {
        id: "s1",
        type: "section",
        variant: "card",
        children: [a, b]
      };

      const clone = cloneBlock(section, base => `${base}_2`) as SectionNode;
      const clonedB = clone.children[1] as TextfieldField;

      expect(clonedB.linkage?.rules?.[0]?.actions[0]).toMatchObject({ type: "set_field", targetKey: "a_2" });
    });
  });

  describe("cloneBlock payload isolation", () => {
    it("does not alias the validate rules object with the source", () => {
      const source: TextfieldField = {
        id: "f1",
        type: "textfield",
        key: "a",
        validate: { required: true, maxLength: 10 }
      };

      const clone = cloneBlock(source, base => base) as TextfieldField;

      expect(clone.validate).not.toBe(source.validate);
      expect(clone.validate).toEqual(source.validate);
    });

    it("does not alias a static dataSource options array with the source", () => {
      const source: SelectField = {
        id: "f1",
        type: "select",
        key: "city",
        dataSource: { kind: "static", options: [{ label: "A", value: "a" }] }
      };

      const clone = cloneBlock(source, base => base) as SelectField;
      const sourceOptions = (source.dataSource as StaticOptionSource).options;
      const cloneOptions = (clone.dataSource as StaticOptionSource).options;

      expect(cloneOptions).not.toBe(sourceOptions);
      expect(cloneOptions[0]).not.toBe(sourceOptions[0]);
      expect(cloneOptions).toEqual(sourceOptions);
    });

    it("does not alias the flex slot object with the source", () => {
      const source: TextfieldField = {
        id: "f1",
        type: "textfield",
        key: "a",
        flex: { grow: 1, basis: "20%" }
      };

      const clone = cloneBlock(source, base => base);

      expect(clone.flex).not.toBe(source.flex);
      expect(clone.flex).toEqual(source.flex);
    });

    it("does not alias an api_call request params object with the source", () => {
      const source = tf("f1", "a");

      source.linkage = {
        rules: [
          {
            id: "Rule_1",
            trigger: { kind: "change" },
            actions: [
              {
                type: "api_call",
                request: {
                  resource: "city",
                  action: "list",
                  params: { page: 1 }
                }
              }
            ]
          }
        ]
      };

      const clone = cloneBlock(source, base => base);
      const sourceAction = source.linkage.rules?.[0]?.actions[0];
      const cloneAction = clone.linkage?.rules?.[0]?.actions[0];

      expect(cloneAction?.type).toBe("api_call");

      if (sourceAction?.type !== "api_call" || cloneAction?.type !== "api_call") {
        throw new Error("Expected api_call actions");
      }

      expect(cloneAction.request).not.toBe(sourceAction.request);
      expect(cloneAction.request.params).not.toBe(sourceAction.request.params);
      expect(cloneAction.request).toEqual(sourceAction.request);
    });

    it("does not alias a literal action value payload with the source", () => {
      const payload = { nested: ["x"] };
      const source = tf("f1", "a");

      source.linkage = {
        rules: [
          {
            id: "Rule_1",
            trigger: { kind: "change" },
            actions: [{ type: "assign", value: { kind: "literal", value: payload } }]
          }
        ]
      };

      const clone = cloneBlock(source, base => base);
      const cloneAction = clone.linkage?.rules?.[0]?.actions[0];

      expect(cloneAction?.type).toBe("assign");

      if (cloneAction?.type !== "assign" || cloneAction.value.kind !== "literal") {
        throw new Error("Expected literal assign action");
      }

      expect(cloneAction.value.value).not.toBe(payload);
      expect(cloneAction.value.value).toEqual(payload);
    });
  });
});
