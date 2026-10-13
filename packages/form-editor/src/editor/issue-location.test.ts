import type { FormSchema } from "../types";

import { describeIssueLocation, locateIssue } from "./issue-location";

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
    it("finds the node on the device that has it", () => {
      expect(locateIssue("node[Field_remark].linkage.rules[0]", makeSchema(), "pc"))
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
    it("opens the data-source tab", () => {
      expect(locateIssue("dataSources[0].request", makeSchema(), "pc")).toEqual({ kind: "tab", tab: "dataSources" });
    });

    it("opens the variables tab", () => {
      expect(locateIssue("variables[1].name", makeSchema(), "pc")).toEqual({ kind: "tab", tab: "variables" });
    });

    it("opens the linkage tab for a form event", () => {
      expect(locateIssue("schema.linkage.rules[0]", makeSchema(), "pc")).toEqual({ kind: "tab", tab: "linkage" });
    });

    it("opens the linkage tab for a dependency cycle", () => {
      expect(locateIssue("linkage", makeSchema(), "pc")).toEqual({ kind: "tab", tab: "linkage" });
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

    it("names the form's own linkage", () => {
      expect(describeIssueLocation("linkage.rules[0]", makeSchema(), "pc")).toBe("表单联动");
    });
  });

  it("has no words for the schema envelope", () => {
    expect(describeIssueLocation("id", makeSchema(), "pc")).toBeUndefined();
  });
});
