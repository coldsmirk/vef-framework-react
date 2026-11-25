import type {
  Block,
  DateField,
  DateRangeField,
  FieldLinkage,
  FieldLinkageRule,
  FormDataSource,
  FormSchema,
  PresentationLayer,
  SelectField,
  SubformNode,
  TextfieldField
} from "../../types";

import {
  hasLinkageDateLiterals,
  hasScopedDateLiterals,
  pruneDataSourceReferences,
  pruneDataSourcesKeyReferences,
  pruneFormRootKeyReferences,
  pruneKeyReferences,
  pruneLinkageKeyReferences,
  renameDataSourcesKeyReferences,
  renameFormRootKeyReferences,
  renameKeyReferences,
  renameLinkageKeyReferences,
  renameVariableReferences,
  scrubDateLiterals,
  scrubLinkageDateLiterals
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

function dateFieldOf(id: string, key: string, extra: Partial<DateField> = {}): DateField {
  return {
    id,
    type: "date",
    key,
    ...extra
  };
}

function dateRangeFieldOf(id: string, key: string, extra: Partial<DateRangeField> = {}): DateRangeField {
  return {
    id,
    type: "daterange",
    key,
    ...extra
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

    it("rewrites a $form sourceKey and keeps its spelling", () => {
      const watcher = tf("f2", "b", { linkage: { rules: [conditionRule("r1", "$form.a")] } });
      const layer = layerOf(tf("f1", "a"), watcher);

      const next = renameKeyReferences(layer, [], "a", "total");

      expect(linkageOf(findNode(next, "f2"))?.rules?.[0]?.trigger).toEqual({
        kind: "condition",
        condition: {
          kind: "leaf",
          sourceKey: "$form.total",
          operator: "empty"
        }
      });
    });

    it("leaves a context sourceKey alone when a same-named key is renamed", () => {
      const watcher = tf("f2", "b", { linkage: { rules: [conditionRule("r1", "$applicant.a")] } });
      const layer = layerOf(tf("f1", "a"), watcher);

      expect(renameKeyReferences(layer, [], "a", "total")).toBe(layer);
    });

    it("rewrites set_fields targetKey, reference paths, and event when guards in the same scope", () => {
      const writer = tf("f2", "b", {
        linkage: {
          rules: [
            {
              id: "r1",
              trigger: {
                kind: "commit",
                when: {
                  kind: "leaf",
                  sourceKey: "$form.a",
                  operator: "notEmpty"
                }
              },
              actions: [
                {
                  type: "api_call",
                  request: {
                    resource: "hr/staff",
                    action: "find",
                    params: { code: { kind: "reference", path: "$form.a" } }
                  },
                  output: "res"
                },
                {
                  type: "set_fields",
                  assignments: [{ targetKey: "a", value: { kind: "reference", path: "$form.a.sub" } }]
                }
              ]
            }
          ]
        }
      });
      const layer = layerOf(tf("f1", "a"), writer);

      const next = renameKeyReferences(layer, [], "a", "total");

      const rule = linkageOf(findNode(next, "f2"))?.rules?.[0];
      expect(rule?.trigger).toMatchObject({ when: { sourceKey: "$form.total" } });
      expect(rule?.actions[0]).toMatchObject({
        type: "api_call",
        request: { params: { code: { kind: "reference", path: "$form.total" } } }
      });
      expect(rule?.actions[1]).toMatchObject({
        type: "set_fields",
        assignments: [{ targetKey: "total", value: { kind: "reference", path: "$form.total.sub" } }]
      });
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

    it("removes a rule whose $form leaf pointed at a removed key", () => {
      const watcher = tf("f2", "b", { linkage: { rules: [conditionRule("r1", "$form.a")] } });
      const layer = layerOf(watcher);

      const next = pruneKeyReferences(layer, [], new Set(["a"]));

      expect(linkageOf(findNode(next, "f2"))?.rules).toEqual([]);
    });

    it("keeps a rule whose context leaf shares a removed key's name", () => {
      const watcher = tf("f2", "b", { linkage: { rules: [conditionRule("r1", "$globals.a")] } });
      const layer = layerOf(watcher);

      expect(pruneKeyReferences(layer, [], new Set(["a"]))).toBe(layer);
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

    it("drops a set_fields action when all its targets are removed and removes the rule emptied by it", () => {
      const writer = tf("f2", "b", {
        linkage: {
          rules: [
            {
              id: "r1",
              trigger: { kind: "change" },
              actions: [
                {
                  type: "set_fields",
                  assignments: [{ targetKey: "a", value: { kind: "literal", value: 1 } }]
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

    it("prunes only the removed assignment inside set_fields when sibling assignments remain", () => {
      const writer = tf("f2", "b", {
        linkage: {
          rules: [
            {
              id: "r1",
              trigger: { kind: "commit" },
              actions: [
                {
                  type: "set_fields",
                  assignments: [
                    { targetKey: "a", value: { kind: "literal", value: 1 } },
                    { targetKey: "keep", value: { kind: "literal", value: 2 } }
                  ]
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
          type: "set_fields",
          assignments: [{ targetKey: "keep", value: { kind: "literal", value: 2 } }]
        }
      ]);
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
                  type: "set_fields",
                  assignments: [{ targetKey: "a", value: { kind: "literal", value: 1 } }]
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
                type: "set_fields",
                assignments: [{ targetKey: "a", value: { kind: "literal", value: 1 } }]
              }
            ]
          }
        ]
      };

      const next = renameLinkageKeyReferences(linkage, "a", "total");

      expect(next.rules?.[0]?.actions[0]).toMatchObject({
        type: "set_fields",
        assignments: [{ targetKey: "total" }]
      });
    });

    it("prunes key references in a bare linkage payload", () => {
      const linkage: FieldLinkage = {
        rules: [
          {
            id: "r1",
            trigger: { kind: "load" },
            actions: [
              {
                type: "set_fields",
                assignments: [{ targetKey: "a", value: { kind: "literal", value: 1 } }]
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

    it("renames and prunes key references in form-level remote dataSources params", () => {
      const sources: FormDataSource[] = [
        {
          id: "DS_1",
          name: "Staff",
          kind: "remote",
          request: {
            resource: "hr/staff",
            action: "find",
            params: {
              dept: { kind: "reference", path: "$form.deptId" },
              keep: { kind: "literal", value: "active" }
            }
          }
        }
      ];

      const renamed = renameDataSourcesKeyReferences(sources, "deptId", "departmentId");
      expect(renamed?.[0]).toMatchObject({
        request: { params: { dept: { kind: "reference", path: "$form.departmentId" } } }
      });

      const pruned = pruneDataSourcesKeyReferences(renamed, [{ scope: [], keys: new Set(["departmentId"]) }]);
      expect(pruned?.[0]).toMatchObject({
        request: { params: { dept: { kind: "reference", path: "" }, keep: { kind: "literal", value: "active" } } }
      });
    });

    it("renames and prunes form-level linkage and remote dataSources together via pruneFormRootKeyReferences / renameFormRootKeyReferences", () => {
      const schema = schemaOf(layerOf(tf("f1", "deptId"), tf("f2", "name")), {
        linkage: {
          rules: [
            {
              id: "r1",
              trigger: { kind: "load" },
              actions: [
                {
                  type: "set_fields",
                  assignments: [{ targetKey: "deptId", value: { kind: "literal", value: "D1" } }]
                }
              ]
            }
          ]
        },
        dataSources: [
          {
            id: "DS_1",
            name: "Teams",
            kind: "remote",
            request: {
              resource: "org/team",
              action: "find",
              params: { dept: { kind: "reference", path: "$form.deptId" } }
            }
          }
        ]
      });

      expect(renameFormRootKeyReferences(schema, "missing", "x")).toBe(schema);
      expect(pruneFormRootKeyReferences(schema, [{ scope: ["lines"], keys: new Set(["deptId"]) }])).toBe(schema);

      const renamed = renameFormRootKeyReferences(schema, "deptId", "orgId");
      expect(renamed.linkage?.rules?.[0]?.actions[0]).toMatchObject({
        type: "set_fields",
        assignments: [{ targetKey: "orgId" }]
      });
      expect(renamed.dataSources?.[0]).toMatchObject({
        request: { params: { dept: { kind: "reference", path: "$form.orgId" } } }
      });

      const pruned = pruneFormRootKeyReferences(renamed, [{ scope: [], keys: new Set(["orgId"]) }]);
      expect(pruned.linkage?.rules).toEqual([]);
      expect(pruned.dataSources?.[0]).toMatchObject({
        request: { params: { dept: { kind: "reference", path: "" } } }
      });
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

    it("clears a fixed-row subform's dangling ref source while preserving its fixed-row shape", () => {
      const subform: SubformNode = {
        id: "sf1",
        type: "subform",
        variant: "table",
        key: "checks",
        rows: {
          mode: "fixed",
          itemKey: "item",
          headerLabel: "自查内容",
          source: { kind: "ref", dataSourceId: "ds1" }
        },
        template: [tf("c1", "note")]
      };
      const schema = schemaOf(layerOf(subform));

      const next = pruneDataSourceReferences(schema, "ds1");
      const updated = findNode(next.presentations.pc, "sf1") as SubformNode | undefined;

      expect(updated?.rows).toEqual({
        mode: "fixed",
        itemKey: "item",
        headerLabel: "自查内容",
        source: { kind: "ref", dataSourceId: "" }
      });
    });
  });

  describe("date granularity literal scrubbing", () => {
    it("scrubs own assign, self condition, sibling condition, and set_fields literals while preserving expressions and non-value operators", () => {
      const dateField = dateFieldOf("D1", "period", {
        linkage: {
          rules: [
            {
              id: "r-own",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "group",
                  logic: "all",
                  children: [
                    {
                      kind: "leaf",
                      sourceKey: "period",
                      operator: "eq",
                      value: "2026-04-15"
                    }
                  ]
                }
              },
              actions: [
                {
                  type: "assign",
                  value: { kind: "literal", value: "2026-04-01" }
                }
              ]
            }
          ]
        }
      });
      const sibling = tf("T1", "note", {
        linkage: {
          rules: [
            {
              id: "r-sibling",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "group",
                  logic: "all",
                  children: [
                    {
                      kind: "leaf",
                      sourceKey: "$form.period",
                      operator: "gte",
                      value: "2026-01-01"
                    },
                    {
                      kind: "leaf",
                      sourceKey: "period",
                      operator: "notEmpty"
                    }
                  ]
                }
              },
              actions: [
                {
                  type: "assign",
                  value: { kind: "literal", value: "keep-sibling-assign" }
                },
                {
                  type: "set_fields",
                  assignments: [{ targetKey: "period", value: { kind: "literal", value: "2026-05-01" } }]
                },
                {
                  type: "set_fields",
                  assignments: [{ targetKey: "period", value: { kind: "expression", source: "'2026-05'" } }]
                }
              ]
            }
          ]
        }
      });
      const untouched = tf("T2", "other");
      const layer = layerOf(dateField, sibling, untouched);

      const next = scrubDateLiterals(layer, [], "D1", {
        key: "period",
        fieldType: "date",
        nextGranularity: "month"
      });

      const ownRule = linkageOf(findNode(next, "D1"))?.rules?.[0];
      expect(ownRule?.actions[0]).toEqual({ type: "assign", value: { kind: "literal", value: "" } });
      expect(ownRule?.trigger).toMatchObject({
        condition: {
          children: [{ sourceKey: "period", value: "" }]
        }
      });

      const siblingRule = linkageOf(findNode(next, "T1"))?.rules?.[0];
      expect(siblingRule?.trigger).toMatchObject({
        condition: {
          children: [
            { sourceKey: "$form.period", value: "" },
            { sourceKey: "period", operator: "notEmpty" }
          ]
        }
      });
      // Sibling's own assign targets `note`, not `period`, so it stays intact.
      expect(siblingRule?.actions[0]).toEqual({
        type: "assign",
        value: { kind: "literal", value: "keep-sibling-assign" }
      });
      expect(siblingRule?.actions[1]).toEqual({
        type: "set_fields",
        assignments: [{ targetKey: "period", value: { kind: "literal", value: "" } }]
      });
      expect(siblingRule?.actions[2]).toEqual({
        type: "set_fields",
        assignments: [{ targetKey: "period", value: { kind: "expression", source: "'2026-05'" } }]
      });
      expect(findNode(next, "T2")).toBe(untouched);
    });

    it("leaves context sourceKeys and already-compatible literals untouched and preserves identity", () => {
      const dateField = dateFieldOf("D1", "period", {
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
                      sourceKey: "$applicant.period",
                      operator: "eq",
                      value: "2026-04-15"
                    },
                    {
                      kind: "leaf",
                      sourceKey: "period",
                      operator: "eq",
                      value: "2026-04"
                    }
                  ]
                }
              },
              actions: [
                {
                  type: "assign",
                  value: { kind: "literal", value: "2026-05" }
                }
              ]
            }
          ]
        }
      });
      const layer = layerOf(dateField);

      expect(scrubDateLiterals(layer, [], "D1", {
        key: "period",
        fieldType: "date",
        nextGranularity: "month"
      })).toBe(layer);
    });

    it("isolates scrubbing to the target scope without touching same-named keys in other scopes", () => {
      const outer = tf("T-out", "out", {
        linkage: {
          rules: [
            {
              id: "r-out",
              trigger: { kind: "change" },
              actions: [
                {
                  type: "set_fields",
                  assignments: [{ targetKey: "period", value: { kind: "literal", value: "2026-04-15" } }]
                }
              ]
            }
          ]
        }
      });
      const innerDate = dateFieldOf("D-in", "period");
      const innerWatcher = tf("T-in", "note", {
        linkage: {
          rules: [
            {
              id: "r-in",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "period",
                  operator: "eq",
                  value: "2026-04-15"
                }
              },
              actions: [{ type: "show" }]
            }
          ]
        }
      });
      const layer = layerOf(
        dateFieldOf("D-out", "period"),
        outer,
        subformOf("sf1", "lines", [innerDate, innerWatcher])
      );

      const next = scrubDateLiterals(layer, ["lines"], "D-in", {
        key: "period",
        fieldType: "date",
        nextGranularity: "year"
      });

      expect(findNode(next, "T-out")).toBe(outer);
      expect(linkageOf(findNode(next, "T-in"))?.rules?.[0]?.trigger).toMatchObject({
        condition: { sourceKey: "period", value: "" }
      });
    });

    it("scrubs incompatible daterange literals and checks contains operands against the target granularity", () => {
      const rangeField = dateRangeFieldOf("R1", "span", {
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
                      sourceKey: "span",
                      operator: "contains",
                      value: "2026-04-15"
                    },
                    {
                      kind: "leaf",
                      sourceKey: "span",
                      operator: "contains",
                      value: "2026-Q2"
                    }
                  ]
                }
              },
              actions: [
                {
                  type: "assign",
                  value: { kind: "literal", value: ["2026-01-01", "2026-03-31"] }
                }
              ]
            }
          ]
        }
      });
      const layer = layerOf(rangeField);

      const next = scrubDateLiterals(layer, [], "R1", {
        key: "span",
        fieldType: "daterange",
        nextGranularity: "quarter"
      });

      const rule = linkageOf(findNode(next, "R1"))?.rules?.[0];
      expect(rule?.trigger).toMatchObject({
        condition: {
          children: [
            {
              sourceKey: "span",
              operator: "contains",
              value: ""
            },
            {
              sourceKey: "span",
              operator: "contains",
              value: "2026-Q2"
            }
          ]
        }
      });
      expect(rule?.actions[0]).toEqual({ type: "assign", value: { kind: "literal", value: "" } });
    });

    it("scrubs a bare form-level linkage payload and preserves identity when already compatible", () => {
      const linkage: FieldLinkage = {
        rules: [
          {
            id: "form-r1",
            trigger: { kind: "load" },
            actions: [
              {
                type: "set_fields",
                assignments: [{ targetKey: "period", value: { kind: "literal", value: "2026-04-15" } }]
              }
            ]
          }
        ]
      };

      expect(scrubLinkageDateLiterals(linkage, {
        key: "period",
        fieldType: "date",
        nextGranularity: "day"
      })).toBe(linkage);

      const next = scrubLinkageDateLiterals(linkage, {
        key: "period",
        fieldType: "date",
        nextGranularity: "month"
      });
      expect(next.rules?.[0]?.actions[0]).toEqual({
        type: "set_fields",
        assignments: [{ targetKey: "period", value: { kind: "literal", value: "" } }]
      });
    });

    it("detects authored literals in scope while ignoring empty values, non-value operators, and expressions", () => {
      const nonLiteralLayer = layerOf(
        dateFieldOf("D1", "period", {
          linkage: {
            rules: [
              {
                id: "r1",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "period",
                    operator: "notEmpty"
                  }
                },
                actions: [
                  {
                    type: "assign",
                    value: { kind: "expression", source: "'2026-04'" }
                  }
                ]
              }
            ]
          }
        })
      );
      expect(hasScopedDateLiterals(nonLiteralLayer, [], "D1", "period")).toBe(false);

      const literalLinkage: FieldLinkage = {
        rules: [
          {
            id: "r2",
            trigger: { kind: "load" },
            actions: [
              {
                type: "set_fields",
                assignments: [{ targetKey: "period", value: { kind: "literal", value: "2026-04-15" } }]
              }
            ]
          }
        ]
      };
      // A field may be keyed `self`; writing it is not writing the rule's own.
      const writesFieldKeyedSelf: FieldLinkage = {
        rules: [
          {
            id: "R",
            trigger: { kind: "change" },
            actions: [{ type: "set_fields", assignments: [{ targetKey: "self", value: { kind: "literal", value: "2026-01-01" } }] }]
          }
        ]
      };

      expect(hasLinkageDateLiterals(writesFieldKeyedSelf, "period", { includeOwnAssign: true })).toBe(false);
      expect(hasLinkageDateLiterals(writesFieldKeyedSelf, "self")).toBe(true);
      expect(hasLinkageDateLiterals(literalLinkage, "period")).toBe(true);
      expect(hasLinkageDateLiterals(literalLinkage, "other")).toBe(false);
    });
  });
});
