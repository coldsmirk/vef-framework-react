import type {
  Block,
  FieldLinkage,
  FieldLinkageRule,
  FormSchema,
  PresentationLayer,
  SelectField,
  SubformNode,
  TextfieldField
} from "../../types";

import {
  pruneDataSourceReferences,
  pruneKeyReferences,
  pruneLinkageKeyReferences,
  renameKeyReferences,
  renameLinkageKeyReferences,
  renameVariableReferences
} from "./reconcile";
import { findField, findNode } from "./walk";

function tf(id: string, key: string, extra: Partial<TextfieldField> = {}): TextfieldField {
  return {
    id,
    type: "textfield",
    key,
    ...extra
  };
}

function subformOf(id: string, key: string, template: Block[]): SubformNode {
  return {
    id,
    type: "subform",
    variant: "stack",
    key,
    template
  };
}

function layerOf(...children: Block[]): PresentationLayer {
  return { children };
}

function conditionRule(id: string, sourceKey: string, actions: FieldLinkageRule["actions"] = [{ type: "hide" }]): FieldLinkageRule {
  return {
    id,
    trigger: {
      kind: "condition",
      condition: {
        kind: "leaf",
        sourceKey,
        operator: "empty"
      }
    },
    actions
  };
}

function schemaOf(pc: PresentationLayer, extra: Partial<FormSchema> = {}): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc },
    ...extra
  };
}

function linkageOf(node: Block | undefined): FieldLinkage | undefined {
  return node?.linkage;
}

function setVariableRule(id: string, variable: string): FieldLinkageRule {
  return {
    id,
    trigger: { kind: "change" },
    actions: [
      {
        type: "set_variable",
        variable,
        value: { kind: "literal", value: 1 }
      }
    ]
  };
}

function selectWithRef(id: string, key: string, dataSourceId: string): SelectField {
  return {
    id,
    type: "select",
    key,
    dataSource: { kind: "ref", dataSourceId }
  };
}

describe("reconcile", () => {
  describe("renameKeyReferences", () => {
    it("rewrites a sibling rule's sourceKey in the root scope", () => {
      const watcher = tf("f2", "b", { linkage: { rules: [conditionRule("r1", "a")] } });
      const layer = layerOf(tf("f1", "a"), watcher);

      const next = renameKeyReferences(layer, [], "a", "total");

      const rule = linkageOf(findNode(next, "f2"))?.rules?.[0];
      expect(rule?.trigger).toEqual({
        kind: "condition",
        condition: {
          kind: "leaf",
          sourceKey: "total",
          operator: "empty"
        }
      });
    });

    it("rewrites a set_field targetKey in the same scope", () => {
      const writer = tf("f2", "b", {
        linkage: {
          rules: [
            {
              id: "r1",
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
        }
      });
      const layer = layerOf(tf("f1", "a"), writer);

      const next = renameKeyReferences(layer, [], "a", "total");

      const action = linkageOf(findNode(next, "f2"))?.rules?.[0]?.actions[0];
      expect(action).toMatchObject({ type: "set_field", targetKey: "total" });
    });

    it("rewrites references inside a subform scope without touching a same-named outer key", () => {
      const innerWatcher = tf("f3", "note", { linkage: { rules: [conditionRule("r-in", "amount")] } });
      const outerWatcher = tf("f4", "b", { linkage: { rules: [conditionRule("r-out", "amount")] } });
      const layer = layerOf(
        tf("f1", "amount"),
        outerWatcher,
        subformOf("sf1", "lines", [tf("f2", "amount"), innerWatcher])
      );

      const next = renameKeyReferences(layer, ["lines"], "amount", "price");

      const inner = linkageOf(findNode(next, "f3"))?.rules?.[0]?.trigger;
      const outer = linkageOf(findNode(next, "f4"))?.rules?.[0]?.trigger;
      expect(inner).toMatchObject({ condition: { sourceKey: "price" } });
      expect(outer).toMatchObject({ condition: { sourceKey: "amount" } });
    });

    it("does not rewrite a subform-internal reference when the outer-scope key is renamed", () => {
      const innerWatcher = tf("f3", "note", { linkage: { rules: [conditionRule("r-in", "amount")] } });
      const layer = layerOf(
        tf("f1", "amount"),
        subformOf("sf1", "lines", [tf("f2", "amount"), innerWatcher])
      );

      const next = renameKeyReferences(layer, [], "amount", "price");

      expect(linkageOf(findNode(next, "f3"))?.rules?.[0]?.trigger).toMatchObject({
        condition: { sourceKey: "amount" }
      });
    });

    it("returns the input layer reference when nothing references the key", () => {
      const layer = layerOf(
        tf("f1", "a"),
        tf("f2", "b", { linkage: { rules: [conditionRule("r1", "b")] } })
      );

      expect(renameKeyReferences(layer, [], "missing", "next")).toBe(layer);
    });

    it("keeps untouched sibling references when one node is rewritten", () => {
      const untouched = tf("f3", "c", { linkage: { rules: [conditionRule("r2", "b")] } });
      const layer = layerOf(
        tf("f1", "a"),
        tf("f2", "b", { linkage: { rules: [conditionRule("r1", "a")] } }),
        untouched
      );

      const next = renameKeyReferences(layer, [], "a", "total");

      expect(next).not.toBe(layer);
      expect(findNode(next, "f3")).toBe(untouched);
    });
  });

  describe("pruneKeyReferences", () => {
    it("removes a rule whose leaf condition pointed at a removed key", () => {
      const watcher = tf("f2", "b", { linkage: { rules: [conditionRule("r1", "a")] } });
      const layer = layerOf(watcher);

      const next = pruneKeyReferences(layer, [], new Set(["a"]));

      expect(linkageOf(findNode(next, "f2"))?.rules).toEqual([]);
    });

    it("cascades leaf → group → rule when the prune empties the group", () => {
      const watcher = tf("f2", "b", {
        linkage: {
          rules: [
            {
              id: "r1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "group",
                  logic: "all",
                  children: [
                    {
                      kind: "leaf",
                      sourceKey: "a",
                      operator: "empty"
                    },
                    {
                      kind: "leaf",
                      sourceKey: "a2",
                      operator: "empty"
                    }
                  ]
                }
              },
              actions: [{ type: "hide" }]
            }
          ]
        }
      });
      const layer = layerOf(watcher);

      const next = pruneKeyReferences(layer, [], new Set(["a", "a2"]));

      expect(linkageOf(findNode(next, "f2"))?.rules).toEqual([]);
    });

    it("keeps a partially pruned group with its surviving children", () => {
      const watcher = tf("f2", "b", {
        linkage: {
          rules: [
            {
              id: "r1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "group",
                  logic: "any",
                  children: [
                    {
                      kind: "leaf",
                      sourceKey: "a",
                      operator: "empty"
                    },
                    {
                      kind: "leaf",
                      sourceKey: "keep",
                      operator: "notEmpty"
                    }
                  ]
                }
              },
              actions: [{ type: "hide" }]
            }
          ]
        }
      });
      const layer = layerOf(watcher);

      const next = pruneKeyReferences(layer, [], new Set(["a"]));

      const trigger = linkageOf(findNode(next, "f2"))?.rules?.[0]?.trigger;
      expect(trigger).toMatchObject({
        condition: {
          kind: "group",
          children: [{ kind: "leaf", sourceKey: "keep" }]
        }
      });
    });

    it("drops a set_field action on a removed target and removes the rule emptied by it", () => {
      const writer = tf("f2", "b", {
        linkage: {
          rules: [
            {
              id: "r1",
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
        }
      });
      const layer = layerOf(writer);

      const next = pruneKeyReferences(layer, [], new Set(["a"]));

      expect(linkageOf(findNode(next, "f2"))?.rules).toEqual([]);
    });

    it("keeps the rule when other actions survive the action prune", () => {
      const writer = tf("f2", "b", {
        linkage: {
          rules: [
            {
              id: "r1",
              trigger: { kind: "change" },
              actions: [
                {
                  type: "set_field",
                  targetKey: "a",
                  value: { kind: "literal", value: 1 }
                },
                {
                  type: "alert",
                  message: { kind: "literal", value: "hi" }
                }
              ]
            }
          ]
        }
      });
      const layer = layerOf(writer);

      const next = pruneKeyReferences(layer, [], new Set(["a"]));

      expect(linkageOf(findNode(next, "f2"))?.rules?.[0]?.actions).toEqual([
        {
          type: "alert",
          message: { kind: "literal", value: "hi" }
        }
      ]);
    });

    it("does not prune a same-named key in a different scope", () => {
      const innerWatcher = tf("f3", "note", { linkage: { rules: [conditionRule("r-in", "amount")] } });
      const layer = layerOf(
        tf("f4", "b", { linkage: { rules: [conditionRule("r-out", "amount")] } }),
        subformOf("sf1", "lines", [innerWatcher])
      );

      const next = pruneKeyReferences(layer, [], new Set(["amount"]));

      // Root-scope reference pruned; the subform-internal one is another binding.
      expect(linkageOf(findNode(next, "f4"))?.rules).toEqual([]);
      expect(linkageOf(findNode(next, "f3"))?.rules).toHaveLength(1);
    });

    it("returns the input layer reference when nothing references the removed keys", () => {
      const layer = layerOf(tf("f2", "b", { linkage: { rules: [conditionRule("r1", "b")] } }));

      expect(pruneKeyReferences(layer, [], new Set(["missing"]))).toBe(layer);
      expect(pruneKeyReferences(layer, [], new Set())).toBe(layer);
    });

    it("keeps a group that was already empty before the prune", () => {
      const watcher = tf("f2", "b", {
        linkage: {
          rules: [
            {
              id: "r1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "group",
                  logic: "all",
                  children: []
                }
              },
              actions: [{ type: "hide" }]
            }
          ]
        }
      });
      const layer = layerOf(watcher);

      // An empty group is mid-authoring state, not a dangling reference.
      expect(pruneKeyReferences(layer, [], new Set(["a"]))).toBe(layer);
    });
  });

  describe("form-level linkage helpers", () => {
    it("renames key references in a bare linkage payload", () => {
      const linkage: FieldLinkage = {
        rules: [
          {
            id: "r1",
            trigger: { kind: "load" },
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

      const next = renameLinkageKeyReferences(linkage, "a", "total");

      expect(next.rules?.[0]?.actions[0]).toMatchObject({ targetKey: "total" });
    });

    it("prunes key references in a bare linkage payload", () => {
      const linkage: FieldLinkage = {
        rules: [
          {
            id: "r1",
            trigger: { kind: "load" },
            actions: [
              {
                type: "set_field",
                targetKey: "a",
                value: { kind: "literal", value: 1 }
              }
            ]
          },
          conditionRule("r2", "keep")
        ]
      };

      const next = pruneLinkageKeyReferences(linkage, new Set(["a"]));

      expect(next.rules).toHaveLength(1);
      expect(next.rules?.[0]?.id).toBe("r2");
    });

    it("returns the input linkage reference when nothing matches", () => {
      const linkage: FieldLinkage = { rules: [conditionRule("r1", "keep")] };

      expect(renameLinkageKeyReferences(linkage, "missing", "x")).toBe(linkage);
      expect(pruneLinkageKeyReferences(linkage, new Set(["missing"]))).toBe(linkage);
    });
  });

  describe("renameVariableReferences", () => {
    it("rewrites set_variable actions across both presentations and the form linkage", () => {
      const rootLayer = layerOf(tf("f1", "a", { linkage: { rules: [setVariableRule("r1", "count")] } }));
      const pcLayer = layerOf(tf("f1", "a", { linkage: { rules: [setVariableRule("r1", "count")] } }));
      const mobileLayer = layerOf(tf("m1", "a", { linkage: { rules: [setVariableRule("r2", "count")] } }));
      const schema = schemaOf(
        rootLayer,
        {
          presentations: {
            pc: pcLayer,
            mobile: mobileLayer
          },
          linkage: { rules: [setVariableRule("r3", "count")] }
        }
      );

      const next = renameVariableReferences(schema, "count", "total");

      const pcAction = linkageOf(findField(next.presentations.pc, "f1"))?.rules?.[0]?.actions[0];
      const mobileAction = linkageOf(findField(next.presentations.mobile ?? { children: [] }, "m1"))?.rules?.[0]?.actions[0];
      expect(pcAction).toMatchObject({ variable: "total" });
      expect(mobileAction).toMatchObject({ variable: "total" });
      expect(next.linkage?.rules?.[0]?.actions[0]).toMatchObject({ variable: "total" });
    });

    it("leaves other variables and non-variable actions untouched", () => {
      const layer = layerOf(tf("f1", "a", { linkage: { rules: [setVariableRule("r1", "other")] } }));
      const schema = schemaOf(layer);

      const next = renameVariableReferences(schema, "count", "total");
      expect(next).toBe(schema);
    });
  });

  describe("pruneDataSourceReferences", () => {
    it("deletes a field's ref option source, leaving the field source-less", () => {
      const schema = schemaOf(layerOf(selectWithRef("f1", "a", "ds1")));

      const next = pruneDataSourceReferences(schema, "ds1");

      const field = findField(next.presentations.pc, "f1");
      expect(field).toBeDefined();
      expect(field && "dataSource" in field).toBe(false);
    });

    it("keeps static and unrelated ref sources", () => {
      const staticField: SelectField = {
        id: "f1",
        type: "select",
        key: "a",
        dataSource: { kind: "static", options: [{ label: "A", value: "a" }] }
      };
      const otherRef = selectWithRef("f2", "b", "ds2");
      const schema = schemaOf(layerOf(staticField, otherRef));

      expect(pruneDataSourceReferences(schema, "ds1")).toBe(schema);
    });

    it("drops refresh_data_source actions and removes a rule emptied by the drop", () => {
      const refresher = tf("f1", "a", {
        linkage: {
          rules: [
            {
              id: "r1",
              trigger: { kind: "change" },
              actions: [{ type: "refresh_data_source", dataSourceId: "ds1" }]
            }
          ]
        }
      });
      const schema = schemaOf(layerOf(refresher), {
        linkage: {
          rules: [
            {
              id: "r2",
              trigger: { kind: "load" },
              actions: [
                { type: "refresh_data_source", dataSourceId: "ds1" },
                { type: "submit" }
              ]
            }
          ]
        }
      });

      const next = pruneDataSourceReferences(schema, "ds1");

      expect(linkageOf(findField(next.presentations.pc, "f1"))?.rules).toEqual([]);
      // The form-level rule keeps its surviving action.
      expect(next.linkage?.rules?.[0]?.actions).toEqual([{ type: "submit" }]);
    });

    it("cleans both presentations", () => {
      const schema = schemaOf(layerOf(selectWithRef("f1", "a", "ds1")), {
        presentations: {
          pc: layerOf(selectWithRef("f1", "a", "ds1")),
          mobile: layerOf(selectWithRef("m1", "a", "ds1"))
        }
      });

      const next = pruneDataSourceReferences(schema, "ds1");

      const pcField = findField(next.presentations.pc, "f1");
      const mobileField = findField(next.presentations.mobile ?? { children: [] }, "m1");
      expect(pcField && "dataSource" in pcField).toBe(false);
      expect(mobileField && "dataSource" in mobileField).toBe(false);
    });

    it("returns the input schema reference when nothing references the source", () => {
      const schema = schemaOf(layerOf(tf("f1", "a")));

      expect(pruneDataSourceReferences(schema, "ds1")).toBe(schema);
    });
  });
});
