import type { ReactNode } from "react";

import type { Block, DataSourceResolver, FormSchema, LinkageEvaluators, SelectField, TextfieldField } from "../types";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";

function renderRuntime(children: ReactNode): void {
  const registry = createDefaultRegistry();

  render(
    <RegistryProvider registries={{ pc: registry, mobile: registry }}>
      {children}
    </RegistryProvider>
  );
}

function stack(...blocks: Block[]): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children: blocks } }
  };
}

const departmentField: TextfieldField = {
  id: "Field_dept",
  type: "textfield",
  key: "deptId",
  label: "deptId"
};

/**
 * The cascading shape: a select whose option request binds a parameter to the
 * field above it.
 */
function wardSelect(source = "deptId"): SelectField {
  return {
    id: "Field_ward",
    type: "select",
    key: "wardId",
    label: "wardId",
    dataSource: {
      kind: "remote",
      request: {
        resource: "sys/ward",
        action: "find_options",
        params: {
          departmentId: { kind: "expression", source },
          active: { kind: "literal", value: true }
        }
      }
    }
  };
}

/**
 * Reads the bound parameter straight out of the form values, standing in for a
 * host expression engine without pulling one into the test.
 */
const evaluators: LinkageEvaluators = {
  evaluateAssignExpression: (source, values) => values[source]
};

describe("FormRenderer bound data-source params", () => {
  it("参数求值后才到达 resolver，且绑定值变化会重新解析", async () => {
    const user = userEvent.setup();
    const resolve = vi.fn().mockResolvedValue([{ label: "W", value: "w" }]);
    const resolver: DataSourceResolver = { resolve };

    renderRuntime(
      <FormRenderer
        dataSourceResolver={resolver}
        evaluators={evaluators}
        schema={stack(departmentField, wardSelect())}
      />
    );

    // 首次解析用的是绑定字段的当前值（文本框的默认值是空串，不是 undefined），
    // 固定参数原样下发。
    await waitFor(() => expect(resolve).toHaveBeenCalled());
    expect(resolve.mock.calls[0]?.[0]).toEqual({
      resource: "sys/ward",
      action: "find_options",
      params: { departmentId: "", active: true }
    });

    await user.type(screen.getByRole("textbox", { name: "deptId" }), "D1");

    // 绑定值变化 ⇒ 解析出的请求变了 ⇒ 缓存键变了 ⇒ 重新拉取。这就是级联。
    await waitFor(() => {
      expect(resolve).toHaveBeenLastCalledWith(
        {
          resource: "sys/ward",
          action: "find_options",
          params: { departmentId: "D1", active: true }
        },
        undefined
      );
    });
  });

  it("宿主不传 evaluators 时用内置求值器 —— 否则联动能用而绑定参数静默失效", async () => {
    const user = userEvent.setup();
    const resolve = vi.fn().mockResolvedValue([{ label: "W", value: "w" }]);

    renderRuntime(
      <FormRenderer
        dataSourceResolver={{ resolve }}
        schema={stack(departmentField, wardSelect("$form.deptId"))}
      />
    );

    await waitFor(() => expect(resolve).toHaveBeenCalled());
    await user.type(screen.getByRole("textbox", { name: "deptId" }), "D1");

    // 内置求值器把表达式当 JS 求值，`$form` 是它自带的作用域，宿主无需接入任何东西。
    await waitFor(() => {
      expect(resolve).toHaveBeenLastCalledWith(
        {
          resource: "sys/ward",
          action: "find_options",
          params: { departmentId: "D1", active: true }
        },
        undefined
      );
    });
  });

  it("子表单行内的绑定参数按本行求值，而不是按整表单", async () => {
    const user = userEvent.setup();
    const resolve = vi.fn().mockResolvedValue([{ label: "W", value: "w" }]);
    const subform: Block = {
      id: "Sub_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      label: "明细",
      minRows: 2,
      template: [departmentField, wardSelect()]
    };

    renderRuntime(
      <FormRenderer
        dataSourceResolver={{ resolve }}
        evaluators={evaluators}
        schema={stack(subform)}
      />
    );

    await waitFor(() => expect(resolve).toHaveBeenCalled());

    // 两行各自输入不同的科室。行作用域生效时，两行解析出的请求不同；
    // 若参数按根 values 求值，`deptId` 不是根键 ⇒ 参数被丢弃 ⇒ 两行请求
    // 完全相同，还会因为缓存键相同而共用同一份选项列表。
    const inputs = screen.getAllByRole("textbox", { name: "deptId" });
    await user.type(inputs[0] as HTMLElement, "D1");
    await user.type(inputs[1] as HTMLElement, "D2");

    const boundDepartments = (): unknown[] => resolve.mock.calls.map(call => (call[0] as { params?: Record<string, unknown> }).params?.departmentId);

    await waitFor(() => {
      expect(boundDepartments()).toEqual(expect.arrayContaining(["D1", "D2"]));
    });
  });

  it("无关按键不会为飞行中的固定参数请求重复发起", async () => {
    // `resolveRequestParams` 每次调用都新建对象，而 paramScope 的身份随任意
    // 表单值变化而变——`schemaHasBoundParams` 是整表单开关，所以一个绑定参数
    // 就把每一个远程数据源都拖进了按键路径。慢接口 + 打字 = 线性放大的重复请求。
    const user = userEvent.setup();
    // 永不 settle：让缓存在整个用例期间保持未命中，暴露飞行窗口内的重复发起。
    const resolve = vi.fn().mockReturnValue(new Promise<never>(() => {
      // Deliberately never settles.
    }));
    const fixedSelect: SelectField = {
      ...wardSelect(),
      id: "Field_fixed",
      key: "fixed",
      dataSource: {
        kind: "remote",
        request: { resource: "sys/fixed", action: "find_options" }
      }
    };

    renderRuntime(
      <FormRenderer
        dataSourceResolver={{ resolve }}
        evaluators={evaluators}
        schema={stack(departmentField, wardSelect(), fixedSelect)}
      />
    );

    await waitFor(() => expect(resolve).toHaveBeenCalled());

    const fixedCalls = (): number => resolve.mock.calls.filter(call => (call[0] as { resource: string }).resource === "sys/fixed").length;
    const before = fixedCalls();

    await user.type(screen.getByRole("textbox", { name: "deptId" }), "abc");

    // 绑定字段的那一个会重新解析（级联本意），固定参数的那个不该动。
    expect(fixedCalls()).toBe(before);
  });

  it("全固定参数的表单不会因无关输入重新解析", async () => {
    const user = userEvent.setup();
    const resolve = vi.fn().mockResolvedValue([{ label: "W", value: "w" }]);
    const fixedSelect: SelectField = {
      ...wardSelect(),
      dataSource: {
        kind: "remote",
        request: {
          resource: "sys/ward",
          action: "find_options",
          params: { active: { kind: "literal", value: true } }
        }
      }
    };

    renderRuntime(
      <FormRenderer
        dataSourceResolver={{ resolve }}
        evaluators={evaluators}
        schema={stack(departmentField, fixedSelect)}
      />
    );

    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));

    await user.type(screen.getByRole("textbox", { name: "deptId" }), "D1");

    // 没有绑定就没有重新解析 —— 每次击键都重拉一遍选项是这类设计器的经典退化。
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
