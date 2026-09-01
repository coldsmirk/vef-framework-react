import type { DynamicValue, RemoteDataSourceRequest, RuntimeSchema } from "../types";

import { describe, expect, it } from "vitest";

import { hasBoundParams, resolveRequestParams, schemaHasBoundParams } from "./data-source-params";

function literal(value: unknown): DynamicValue {
  return { kind: "literal", value };
}

function expression(source: string): DynamicValue {
  return { kind: "expression", source };
}

function request(params?: Record<string, DynamicValue>): RemoteDataSourceRequest {
  return {
    resource: "sys/user",
    action: "find_options",
    ...params && { params }
  };
}

function schemaWith(children: RuntimeSchema["children"], dataSources?: RuntimeSchema["dataSources"]): RuntimeSchema {
  return {
    children,
    ...dataSources && { dataSources }
  } as RuntimeSchema;
}

function selectField(id: string, dataSource: unknown): RuntimeSchema["children"][number] {
  return {
    id,
    type: "select",
    key: id,
    label: id,
    dataSource
  } as unknown as RuntimeSchema["children"][number];
}

describe("hasBoundParams", () => {
  it("固定参数不算绑定，因此运行时可以完全跳过求值路径", () => {
    const fixed = request({ page: literal(1) });

    expect(hasBoundParams(request())).toBe(false);
    expect(hasBoundParams(fixed)).toBe(false);
  });

  it("只要有一个表达式参数就算绑定", () => {
    const mixed = request({ page: literal(1), deptId: expression("$form.deptId") });

    expect(hasBoundParams(mixed)).toBe(true);
  });
});

describe("resolveRequestParams", () => {
  it("无参数时原样返回", () => {
    const original = request();

    expect(resolveRequestParams(original, () => "x")).toEqual(original);
  });

  it("把参数求值成普通值，resolver 永远看不到表达式", () => {
    const resolved = resolveRequestParams(
      request({ page: literal(1), deptId: expression("$form.deptId") }),
      param => param.kind === "literal" ? param.value : "D1"
    );

    expect(resolved.params).toEqual({ page: 1, deptId: "D1" });
  });

  it("求值为 undefined 的参数被剔除而不是发成 undefined", () => {
    // 绑定字段还没填时就是这个形态：发一个值为 undefined 的键会逼后端特判。
    const resolved = resolveRequestParams(
      request({ deptId: expression("$form.deptId"), page: literal(1) }),
      param => param.kind === "literal" ? param.value : undefined
    );

    expect(resolved.params).toEqual({ page: 1 });
    expect(Object.hasOwn(resolved.params ?? {}, "deptId")).toBe(false);
  });

  it("不改动原请求", () => {
    const original = request({ deptId: expression("$form.deptId") });

    resolveRequestParams(original, () => "D1");

    expect(original.params).toEqual({ deptId: expression("$form.deptId") });
  });
});

describe("schemaHasBoundParams", () => {
  it("全部固定参数时为 false —— 这正是不订阅表单值的依据", () => {
    const fixed = request({ page: literal(1) });
    const schema = schemaWith(
      [selectField("f1", { kind: "remote", request: fixed })],
      [
        {
          id: "ds1",
          name: "用户",
          kind: "remote",
          request: request()
        }
      ]
    );

    expect(schemaHasBoundParams(schema)).toBe(false);
  });

  it("表单级数据源绑定时为 true", () => {
    const schema = schemaWith([], [
      {
        id: "ds1",
        name: "用户",
        kind: "remote",
        request: request({ deptId: expression("$form.deptId") })
      }
    ]);

    expect(schemaHasBoundParams(schema)).toBe(true);
  });

  it("字段内联数据源绑定时为 true", () => {
    const bound = request({ deptId: expression("$form.deptId") });
    const schema = schemaWith([selectField("f1", { kind: "remote", request: bound })]);

    expect(schemaHasBoundParams(schema)).toBe(true);
  });

  it("api_call 联动动作绑定时也为 true —— 两条链路共用同一份参数形状", () => {
    const field = selectField("f1", undefined) as unknown as Record<string, unknown>;
    field.linkage = {
      rules: [
        {
          id: "Rule_1",
          trigger: { kind: "change" },
          actions: [{ type: "api_call", request: request({ deptId: expression("$form.deptId") }) }]
        }
      ]
    };

    expect(schemaHasBoundParams(schemaWith([field as never]))).toBe(true);
  });
});
