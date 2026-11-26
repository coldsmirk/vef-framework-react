import type { FormSchema } from "../types";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { createDefaultMobileRegistry } from "../engine/registry/defaults-mobile";
import { describeIssueLocation, locateIssue } from "./issue-location";

const REGISTRIES = {
  pc: createDefaultRegistry(),
  mobile: createDefaultMobileRegistry()
};

/**
 * pc: a section holding `amount`, a tabs container whose second tab holds
 * `note`, and a subform `lines` whose template holds `price`.
 * mobile: one field `remark`.
 */
function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Section_1",
            type: "section",
            variant: "card",
            children: [
              {
                id: "Field_amount",
                type: "number",
                key: "amount",
                label: "金额"
              }
            ]
          },
          {
            id: "Tabs_1",
            type: "tabs",
            tabs: [
              {
                id: "Tab_1",
                label: "一",
                children: []
              },
              {
                id: "Tab_2",
                label: "二",
                children: [
                  {
                    id: "Field_note",
                    type: "textfield",
                    key: "note"
                  }
                ]
              }
            ]
          },
          {
            id: "Subform_lines",
            type: "subform",
            variant: "stack",
            key: "lines",
            template: [
              {
                id: "Field_price",
                type: "number",
                key: "price"
              }
            ]
          }
        ]
      },
      mobile: {
        children: [
          {
            id: "Field_remark",
            type: "textfield",
            key: "remark"
          }
        ]
      }
    }
  };
}

describe("locateIssue", () => {
  describe("when the path walks a presentation tree", () => {
    it("reaches a field inside a section", () => {
      expect(locateIssue("presentations.pc.children[0].children[0].key", makeSchema(), "pc"))
        .toEqual({
          kind: "node",
          device: "pc",
          nodeId: "Field_amount"
        });
    });

    it("reaches a field inside a tab", () => {
      expect(locateIssue("presentations.pc.children[1].tabs[1].children[0].label", makeSchema(), "pc"))
        .toEqual({
          kind: "node",
          device: "pc",
          nodeId: "Field_note"
        });
    });

    it("reaches a field inside a subform template", () => {
      expect(locateIssue("presentations.pc.children[2].template[0].dataSource.request", makeSchema(), "pc"))
        .toEqual({
          kind: "node",
          device: "pc",
          nodeId: "Field_price"
        });
    });

    it("stops at the container when the path is about the container itself", () => {
      expect(locateIssue("presentations.pc.children[1].tabs[0].label", makeSchema(), "pc"))
        .toEqual({
          kind: "node",
          device: "pc",
          nodeId: "Tabs_1"
        });
    });

    it("targets the device the path names", () => {
      expect(locateIssue("presentations.mobile.children[0].key", makeSchema(), "pc"))
        .toEqual({
          kind: "node",
          device: "mobile",
          nodeId: "Field_remark"
        });
    });

    it("finds nothing past the end of a list", () => {
      expect(locateIssue("presentations.pc.children[9].key", makeSchema(), "pc")).toBeUndefined();
    });
  });

  describe("when the path names a node by id", () => {
    it("targets the exact linkage rule (and optional action) on the device that has it", () => {
      expect(locateIssue("node[Field_remark].linkage.rules[0]", makeSchema(), "pc"))
        .toEqual({
          kind: "linkage",
          device: "mobile",
          focus: { nodeId: "Field_remark", ruleIndex: 0 }
        });
      expect(locateIssue("node[Field_remark].linkage.rules[0].actions[2].assignments[0].targetKey", makeSchema(), "pc"))
        .toEqual({
          kind: "linkage",
          device: "mobile",
          focus: {
            nodeId: "Field_remark",
            ruleIndex: 0,
            actionIndex: 2
          }
        });
    });

    it("falls back to the node target for a non-rule linkage path", () => {
      expect(locateIssue("node[Field_remark].linkage", makeSchema(), "pc"))
        .toEqual({
          kind: "node",
          device: "mobile",
          nodeId: "Field_remark"
        });
    });

    it("finds nothing for a removed node", () => {
      expect(locateIssue("node[Field_gone].linkage", makeSchema(), "pc")).toBeUndefined();
    });
  });

  describe("when the path names form-level configuration", () => {
    it("targets a specific data source when the index resolves to one", () => {
      const schema: FormSchema = {
        ...makeSchema(),
        dataSources: [
          {
            id: "DataSource_1",
            name: "部门",
            kind: "remote",
            request: { resource: "", action: "" }
          }
        ]
      };

      expect(locateIssue("dataSources[0].request", schema, "pc")).toEqual({
        kind: "dataEntry",
        entry: { kind: "dataSource", id: "DataSource_1" }
      });
    });

    it("falls back to the sidebar data tab when a data-source path has no resolvable entry", () => {
      expect(locateIssue("dataSources[0].request", makeSchema(), "pc")).toEqual({ kind: "sidebar", tab: "data" });
      expect(locateIssue("dataSources", makeSchema(), "pc")).toEqual({ kind: "sidebar", tab: "data" });
    });

    it("targets a specific variable when the index resolves to one", () => {
      const schema: FormSchema = {
        ...makeSchema(),
        variables: [
          {
            id: "Variable_1",
            name: "quota",
            type: "number"
          }
        ]
      };

      expect(locateIssue("variables[0].name", schema, "pc")).toEqual({
        kind: "dataEntry",
        entry: { kind: "variable", id: "Variable_1" }
      });
    });

    it("falls back to the sidebar data tab when a variable path has no resolvable entry", () => {
      expect(locateIssue("variables[1].name", makeSchema(), "pc")).toEqual({ kind: "sidebar", tab: "data" });
    });

    it("targets the exact form event rule and action", () => {
      expect(locateIssue("schema.linkage.rules[0]", makeSchema(), "pc")).toEqual({
        kind: "linkage",
        device: "pc",
        focus: { nodeId: null, ruleIndex: 0 }
      });
      expect(locateIssue("schema.linkage.rules[1].actions[0].output", makeSchema(), "pc")).toEqual({
        kind: "linkage",
        device: "pc",
        focus: {
          nodeId: null,
          ruleIndex: 1,
          actionIndex: 0
        }
      });
    });

    it("targets the properties form tab for a dependency cycle", () => {
      expect(locateIssue("linkage", makeSchema(), "pc")).toEqual({ kind: "properties", tab: "form" });
    });
  });

  describe("when the path is a field-key chain", () => {
    it("finds a root field", () => {
      expect(locateIssue("amount", makeSchema(), "pc")).toEqual({
        kind: "node",
        device: "pc",
        nodeId: "Field_amount"
      });
    });

    it("finds a field inside a subform scope", () => {
      expect(locateIssue("lines.price", makeSchema(), "pc")).toEqual({
        kind: "node",
        device: "pc",
        nodeId: "Field_price"
      });
    });

    it("does not match a same-named key in another scope", () => {
      expect(locateIssue("price", makeSchema(), "pc")).toBeUndefined();
    });

    it("falls back to the other device", () => {
      expect(locateIssue("remark", makeSchema(), "pc")).toEqual({
        kind: "node",
        device: "mobile",
        nodeId: "Field_remark"
      });
    });
  });

  it("finds nothing for the schema envelope", () => {
    expect(locateIssue("id", makeSchema(), "pc")).toBeUndefined();
  });
});

describe("describeIssueLocation", () => {
  describe("when the issue is about a field", () => {
    it("names the field by its label", () => {
      expect(describeIssueLocation("presentations.pc.children[0].children[0].key", makeSchema(), "pc")).toBe("金额");
    });

    it("falls back to the field's key", () => {
      expect(describeIssueLocation("presentations.pc.children[1].tabs[1].children[0].key", makeSchema(), "pc")).toBe("note");
    });

    it("marks a field of the mobile layout", () => {
      expect(describeIssueLocation("presentations.mobile.children[0].key", makeSchema(), "pc")).toBe("移动端 · remark");
    });
  });

  describe("when the issue is about form-level configuration", () => {
    it("names a data source by its name", () => {
      const schema: FormSchema = {
        ...makeSchema(),
        dataSources: [
          {
            id: "DataSource_1",
            name: "部门",
            kind: "static",
            options: []
          }
        ]
      };

      expect(describeIssueLocation("dataSources[0].request", schema, "pc")).toBe("数据源「部门」");
    });

    it("numbers a data source that has no name", () => {
      const schema: FormSchema = {
        ...makeSchema(),
        dataSources: [
          {
            id: "DataSource_1",
            name: "",
            kind: "static",
            options: []
          }
        ]
      };

      expect(describeIssueLocation("dataSources[0].request", schema, "pc")).toBe("数据源 #1");
    });

    it("names a variable by its name", () => {
      const schema: FormSchema = {
        ...makeSchema(),
        variables: [
          {
            id: "Variable_1",
            name: "quota",
            type: "number"
          }
        ]
      };

      expect(describeIssueLocation("variables[0].defaultValue", schema, "pc")).toBe("变量「quota」");
    });

    it("names the form's own linkage rule and action in designer words", () => {
      const schema: FormSchema = {
        ...makeSchema(),
        linkage: {
          rules: [
            {
              id: "R1",
              trigger: { kind: "load" },
              actions: [
                {
                  id: "A1",
                  type: "select_record",
                  source: { kind: "reference", path: "" },
                  output: "selected"
                }
              ]
            }
          ]
        }
      };

      expect(describeIssueLocation("linkage.rules[0]", schema, "pc")).toBe("表单事件 · 规则 1");
      expect(describeIssueLocation("schema.linkage.rules[0].actions[0].source", schema, "pc"))
        .toBe("表单事件 · 规则 1 · 步骤 1（选择记录）");
      expect(describeIssueLocation("linkage", schema, "pc")).toBe("表单联动");
    });

    it("names a node linkage rule, guard, and action step in designer words", () => {
      const schema = makeSchema();
      const amount = schema.presentations.pc.children[0];

      if (amount?.type === "section" && amount.children[0]?.type === "number") {
        amount.children[0].linkage = {
          rules: [
            {
              id: "R1",
              trigger: { kind: "commit" },
              actions: [
                {
                  id: "A1",
                  type: "set_fields",
                  assignments: [{ targetKey: "", value: { kind: "literal", value: "" } }]
                }
              ]
            }
          ]
        };
      }

      expect(describeIssueLocation("node[Field_amount].linkage.rules[0].actions[0].assignments[0].targetKey", schema, "pc"))
        .toBe("金额 · 规则 1 · 步骤 1（设置字段）");
      expect(describeIssueLocation("node[Field_amount].linkage.rules[0].trigger.when.children[0].sourceKey", schema, "pc"))
        .toBe("金额 · 规则 1 · 执行条件");
    });

    it("names container linkage rules by registry type name rather than raw id, keeping the mobile prefix", () => {
      const schema = makeSchema();

      schema.presentations.pc.children.push({
        id: "Field_blkuy0tgvlb6r4fi",
        type: "flex",
        children: [],
        linkage: {
          rules: [
            {
              id: "R_flex",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "amount",
                  operator: "notEmpty"
                }
              },
              actions: [
                {
                  id: "A_api",
                  type: "api_call",
                  request: { resource: "", action: "" },
                  output: "result"
                }
              ]
            }
          ]
        }
      });
      schema.presentations.mobile?.children.push({
        id: "Flex_mobile",
        type: "flex",
        children: [],
        linkage: {
          rules: [
            {
              id: "R_m_flex",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "remark",
                  operator: "notEmpty"
                }
              },
              actions: [{ id: "A_m_show", type: "show" }]
            }
          ]
        }
      });

      expect(describeIssueLocation("node[Field_blkuy0tgvlb6r4fi].linkage.rules[0].actions[0].request", schema, "pc", REGISTRIES))
        .toBe("弹性布局 · 规则 1 · 步骤 1（调用接口）");
      expect(describeIssueLocation("node[Flex_mobile].linkage.rules[0]", schema, "pc", REGISTRIES))
        .toBe("移动端 · 弹性布局 · 规则 1");
      expect(describeIssueLocation("presentations.pc.children[0].title", schema, "pc", REGISTRIES))
        .toBe("卡片");
    });
  });

  it("has no words for the schema envelope", () => {
    expect(describeIssueLocation("id", makeSchema(), "pc")).toBeUndefined();
  });
});
