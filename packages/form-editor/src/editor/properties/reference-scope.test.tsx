import type { ReferenceScope } from "./reference-scope";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { buildReferenceOptions, ReferencePicker, ReferenceScopeProvider } from "./reference-scope";

const FULL_SCOPE: ReferenceScope = {
  fieldOptions: [
    { value: "code", label: "工号 · code" },
    { value: "name", label: "姓名 · name" }
  ],
  variables: [
    {
      id: "V1",
      name: "batchId",
      type: "string"
    }
  ],
  contextSources: [{ key: "$applicant.departmentId", label: "申请人部门" }],
  priorSteps: [
    {
      index: 0,
      output: "result",
      label: "职员查询",
      kind: "api_call",
      fields: [
        { path: "name", label: "姓名" },
        { path: "phoneNumber", label: "手机号" }
      ]
    },
    {
      index: 1,
      output: "raw",
      label: "原始接口",
      kind: "api_call",
      fields: []
    }
  ]
};

describe("buildReferenceOptions & ReferencePicker", () => {
  it("groups earlier steps, form fields, variables, and system variables in one candidate list", () => {
    const resolved = buildReferenceOptions(FULL_SCOPE, "$steps.result.name");

    expect(resolved.unresolved).toBe(false);
    expect(resolved.selectValue).toBe("$steps.result.name");
    expect(resolved.freeStepTarget).toBeNull();
    expect(resolved.options.map(group => "label" in group ? group.label : "")).toEqual([
      "步骤 1 · 职员查询",
      "步骤 2 · 原始接口",
      "表单字段",
      "表单变量",
      "系统变量"
    ]);
  });

  it("lists fields without a heading when there is nothing else", () => {
    const resolved = buildReferenceOptions({
      ...FULL_SCOPE,
      variables: [],
      contextSources: [],
      priorSteps: undefined
    }, "code");

    expect(resolved.options.map(option => option.label)).toEqual(["工号 · code", "姓名 · name"]);
  });

  it("recognizes explicit $form.<key> references and flags unknown paths with 未识别", () => {
    const explicit = buildReferenceOptions(FULL_SCOPE, "$form.code");
    expect(explicit.unresolved).toBe(false);

    const dangling = buildReferenceOptions(FULL_SCOPE, "$steps.missing.name");
    expect(dangling.unresolved).toBe(true);
  });

  it("exposes an inline sub-path input when targeting a step without declared fields", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Harness() {
      const [path, setPath] = useState("$steps.raw.profile.email");

      return (
        <ReferenceScopeProvider value={FULL_SCOPE}>
          <ReferencePicker
            value={path}
            onChange={next => {
              onChange(next);
              setPath(next);
            }}
          />
        </ReferenceScopeProvider>
      );
    }

    render(<Harness />);

    const subPathInput = screen.getByLabelText("结果属性路径");
    expect(subPathInput).toHaveValue("profile.email");

    await user.clear(subPathInput);
    await user.type(subPathInput, "dept.title");
    expect(onChange).toHaveBeenLastCalledWith("$steps.raw.dept.title");

    await user.clear(subPathInput);
    expect(onChange).toHaveBeenLastCalledWith("$steps.raw");
  });
});
