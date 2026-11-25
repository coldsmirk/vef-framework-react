import type { DataSourceApi, FormSchema } from "../../types";

import {
  collectDataSourceUsages,
  formatDataSourceRemovalLines,
  nextCopyName,
  summarizeDataSource
} from "./data-source-usage";

const APIS: DataSourceApi[] = [
  {
    label: "部门列表",
    resource: "sys/department",
    action: "find_options",
    params: [
      {
        name: "orgId",
        label: "机构",
        required: true
      },
      { name: "status", label: "状态" }
    ]
  },
  {
    label: "用户列表",
    resource: "sys/user",
    action: "find_options",
    version: "v2"
  }
];

describe("collectDataSourceUsages", () => {
  it("counts references across PC/mobile fields, fixed-row subforms, node linkages, and form linkage", () => {
    const schema: FormSchema = {
      id: "Form_1",
      version: 2,
      dataSources: [
        {
          id: "ds1",
          name: "部门",
          kind: "static",
          options: [{ label: "研发部", value: "rd" }]
        }
      ],
      linkage: {
        rules: [
          {
            id: "r-form",
            trigger: { kind: "load" },
            actions: [
              { type: "refresh_data_source", dataSourceId: "ds1" },
              {
                type: "alert",
                level: "info",
                message: { kind: "literal", value: "ok" }
              }
            ]
          }
        ]
      },
      presentations: {
        pc: {
          children: [
            {
              id: "f-dept",
              type: "select",
              key: "dept",
              label: "所属部门",
              dataSource: { kind: "ref", dataSourceId: "ds1" }
            },
            {
              id: "sub-matrix",
              type: "subform",
              variant: "table",
              key: "items",
              label: "评分明细",
              rows: {
                mode: "fixed",
                itemKey: "item",
                source: { kind: "ref", dataSourceId: "ds1" }
              },
              template: [
                {
                  id: "f-score",
                  type: "number",
                  key: "score",
                  label: "分数"
                }
              ]
            },
            {
              id: "f-trigger",
              type: "textfield",
              key: "code",
              label: "编码",
              linkage: {
                rules: [
                  {
                    id: "r-node",
                    trigger: { kind: "commit" },
                    actions: [{ type: "refresh_data_source", dataSourceId: "ds1" }]
                  }
                ]
              }
            }
          ]
        },
        mobile: {
          children: [
            {
              id: "m-dept",
              type: "select",
              key: "dept",
              label: "所属部门",
              dataSource: { kind: "ref", dataSourceId: "ds1" }
            }
          ]
        }
      }
    };

    const usages = collectDataSourceUsages(schema);
    const usage = usages.get("ds1");

    expect(usage).toEqual({
      total: 5,
      fields: [
        {
          device: "pc",
          nodeId: "f-dept",
          label: "所属部门",
          kind: "field"
        },
        {
          device: "mobile",
          nodeId: "m-dept",
          label: "移动端 · 所属部门",
          kind: "field"
        }
      ],
      fixedSubforms: [
        {
          device: "pc",
          nodeId: "sub-matrix",
          label: "评分明细",
          kind: "fixed-subform"
        }
      ],
      linkages: [
        {
          scope: "pc",
          ownerLabel: "编码",
          actionCount: 1,
          removedRuleCount: 1
        },
        {
          scope: "form",
          ownerLabel: "表单级事件",
          actionCount: 1,
          removedRuleCount: 0
        }
      ]
    });

    // Memoized by schema identity.
    expect(collectDataSourceUsages(schema)).toBe(usages);

    const lines = formatDataSourceRemovalLines(usage!);

    expect(lines).toEqual([
      "以下字段将清空选项来源：「所属部门」、「移动端 · 所属部门」",
      "以下固定行明细表将清空行项目来源：「评分明细」",
      "将移除 2 个联动刷新动作（来自 「编码」、表单级事件），其中 1 条规则将被一并移除"
    ]);
  });

  it("caps long reference lists cleanly in confirmation lines", () => {
    const children = Array.from({ length: 10 }, (_, index) => {
      return {
        id: `f-${index}`,
        type: "select" as const,
        key: `k${index}`,
        label: `字段${index + 1}`,
        dataSource: { kind: "ref" as const, dataSourceId: "ds1" }
      };
    });
    const schema: FormSchema = {
      id: "Form_1",
      version: 2,
      presentations: { pc: { children } }
    };
    const usage = collectDataSourceUsages(schema).get("ds1")!;

    expect(usage.total).toBe(10);
    expect(formatDataSourceRemovalLines(usage)).toEqual(["以下字段将清空选项来源：「字段1」、「字段2」、「字段3」、「字段4」、「字段5」、「字段6」、「字段7」、「字段8」等共 10 个字段"]);
  });
});

describe("summarizeDataSource", () => {
  it("summarizes static sources and flags empty lists as incomplete", () => {
    expect(summarizeDataSource({
      id: "ds1",
      name: "状态",
      kind: "static",
      options: [{ label: "正常", value: "ok" }, { label: "停用", value: "off" }]
    }, APIS)).toEqual({ text: "静态 · 2 项", incomplete: false });

    expect(summarizeDataSource({
      id: "ds2",
      name: "空列表",
      kind: "static",
      options: []
    }, APIS)).toEqual({ text: "静态 · 0 项", incomplete: true });
  });

  it("summarizes catalog APIs and flags unbound required parameters", () => {
    expect(summarizeDataSource({
      id: "ds1",
      name: "用户",
      kind: "remote",
      request: {
        resource: "sys/user",
        action: "find_options",
        version: "v2"
      }
    }, APIS)).toEqual({ text: "接口 · 用户列表", incomplete: false });

    expect(summarizeDataSource({
      id: "ds2",
      name: "部门",
      kind: "remote",
      request: {
        resource: "sys/department",
        action: "find_options"
      }
    }, APIS)).toEqual({ text: "接口 · 部门列表（缺少必填参数）", incomplete: true });

    expect(summarizeDataSource({
      id: "ds3",
      name: "部门",
      kind: "remote",
      request: {
        resource: "sys/department",
        action: "find_options",
        params: { orgId: { kind: "reference", path: "$applicant.departmentId" } }
      }
    }, APIS)).toEqual({ text: "接口 · 部门列表", incomplete: false });
  });

  it("summarizes custom remote requests and flags incomplete endpoints", () => {
    expect(summarizeDataSource({
      id: "ds1",
      name: "仓库",
      kind: "remote",
      request: { resource: "inv/warehouse", action: "find_options" }
    }, APIS)).toEqual({ text: "接口 · inv/warehouse / find_options", incomplete: false });

    expect(summarizeDataSource({
      id: "ds2",
      name: "空白",
      kind: "remote",
      request: { resource: "", action: "" }
    }, APIS)).toEqual({ text: "接口 · 未配置", incomplete: true });

    expect(summarizeDataSource({
      id: "ds3",
      name: "缺动作",
      kind: "remote",
      request: { resource: "inv/warehouse", action: "" }
    }, APIS)).toEqual({ text: "接口 · inv/warehouse / 未配置", incomplete: true });

    expect(summarizeDataSource({
      id: "ds4",
      name: "缺资源",
      kind: "remote",
      request: { resource: "", action: "find_options" }
    }, APIS)).toEqual({ text: "接口 · 未配置 / find_options", incomplete: true });
  });
});

describe("nextCopyName", () => {
  it("appends 副本 and increments numeric suffixes on collision", () => {
    expect(nextCopyName("城市", new Set(["城市"]))).toBe("城市 副本");
    expect(nextCopyName("城市", new Set(["城市", "城市 副本"]))).toBe("城市 副本 2");
    expect(nextCopyName("城市", new Set(["城市", "城市 副本", "城市 副本 2"]))).toBe("城市 副本 3");
    expect(nextCopyName("  ", new Set())).toBe("数据源 副本");
  });
});
