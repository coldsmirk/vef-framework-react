import type { FormSchema } from "@vef-framework-react/form-editor";

import { render, screen } from "@testing-library/react";

import { InstanceFormPanel } from "./index";

/**
 * Two fields shown only for a finance applicant — one keyed on the applicant
 * snapshot, one on a form-visible host global.
 */
const SCHEMA: FormSchema = {
  id: "Form_1",
  version: 2,
  presentations: {
    pc: {
      children: [
        {
          id: "Field_budget",
          type: "textfield",
          key: "budget",
          label: "预算",
          linkage: {
            defaults: { hidden: true },
            rules: [
              {
                id: "Rule_1",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "$applicant.departmentId",
                    operator: "eq",
                    value: "dept-finance"
                  }
                },
                actions: [{ type: "show" }]
              }
            ]
          }
        },
        {
          id: "Field_title",
          type: "textfield",
          key: "title",
          label: "职称说明",
          linkage: {
            defaults: { hidden: true },
            rules: [
              {
                id: "Rule_2",
                trigger: {
                  kind: "condition",
                  condition: { kind: "expression", source: "$globals.staffTitle === '主任医师'" }
                },
                actions: [{ type: "show" }]
              }
            ]
          }
        }
      ]
    }
  }
};

describe("InstanceFormPanel", () => {
  it("evaluates rules about the initiator against the applicant", () => {
    render(
      <InstanceFormPanel
        schema={SCHEMA}
        applicant={{
          id: "u-1",
          name: "张三",
          departmentId: "dept-finance"
        }}
      />
    );

    expect(screen.getByRole("textbox", { name: "预算" })).toBeInTheDocument();
  });

  it("keeps an initiator-only field hidden for another applicant", () => {
    render(
      <InstanceFormPanel
        schema={SCHEMA}
        applicant={{
          id: "u-2",
          name: "李四",
          departmentId: "dept-it"
        }}
      />
    );

    expect(screen.queryByRole("textbox", { name: "预算" })).not.toBeInTheDocument();
  });

  it("evaluates rules against the form-visible globals", () => {
    render(<InstanceFormPanel globals={{ staffTitle: "主任医师" }} schema={SCHEMA} />);

    expect(screen.getByRole("textbox", { name: "职称说明" })).toBeInTheDocument();
  });
});
