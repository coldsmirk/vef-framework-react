import type { FormSchema } from "@vef-framework-react/form-editor";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ApprovalProvider } from "../../plugins";
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

  it("wires ApprovalProvider plugins.services into the rendered FormRenderer", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockResolvedValue({ fullName: "Ada Lovelace" });
    const lookupSchema: FormSchema = {
      id: "Form_lookup",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Field_code",
              type: "textfield",
              key: "code",
              label: "工号",
              linkage: {
                rules: [
                  {
                    id: "Rule_lookup",
                    trigger: { kind: "commit" },
                    actions: [
                      {
                        type: "api_call",
                        request: {
                          resource: "hr/staff",
                          action: "find",
                          params: { code: { kind: "reference", path: "$form.code" } }
                        },
                        output: "staff"
                      },
                      {
                        type: "set_fields",
                        assignments: [{ targetKey: "fullName", value: { kind: "reference", path: "$steps.staff.fullName" } }]
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: "Field_fullName",
              type: "textfield",
              key: "fullName",
              label: "姓名"
            }
          ]
        }
      }
    };

    render(
      <ApprovalProvider plugins={{ services: { request } }}>
        <InstanceFormPanel schema={lookupSchema} />
      </ApprovalProvider>
    );

    const codeInput = screen.getByRole("textbox", { name: "工号" });
    await user.type(codeInput, "E001{Enter}");

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Ada Lovelace");
    });
    expect(request).toHaveBeenCalledWith(
      {
        resource: "hr/staff",
        action: "find",
        params: { code: "E001" }
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
