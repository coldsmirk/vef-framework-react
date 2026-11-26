import type { FormSchema } from "@vef-framework-react/form-editor";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDefaultMobileRegistry, createDefaultRegistry } from "@vef-framework-react/form-editor";

import { ApprovalProvider } from "../../plugins";
import { ApprovalFormEditor } from "./index";

/**
 * A nested subform: the designer accepts it, the approval contract does not.
 */
const NESTED_SUBFORM_SCHEMA: FormSchema = {
  id: "Form_1",
  version: 2,
  presentations: {
    pc: {
      children: [
        {
          id: "Sub",
          type: "subform",
          variant: "stack",
          key: "items",
          label: "明细",
          template: [
            {
              id: "Nested",
              type: "subform",
              variant: "stack",
              key: "parts",
              label: "子明细",
              template: [
                {
                  id: "Part",
                  type: "textfield",
                  key: "part",
                  label: "部件"
                }
              ]
            }
          ]
        }
      ]
    }
  }
};

describe("ApprovalFormEditor", () => {
  it("offers the applicant attributes and the declared form globals as system variables", async () => {
    const user = userEvent.setup();
    render(
      <ApprovalProvider plugins={{ formGlobals: [{ key: "staffTitle", label: "发起人职称" }] }}>
        <ApprovalFormEditor />
      </ApprovalProvider>
    );

    const sidebar = await screen.findByRole("complementary", { name: "侧边栏" });
    await user.click(within(sidebar).getByRole("tab", { name: "数据" }));

    expect(within(sidebar).getByText("系统变量")).toBeInTheDocument();
    expect(within(sidebar).getByText("发起人部门")).toBeInTheDocument();
    expect(within(sidebar).getByText("发起人职称")).toBeInTheDocument();
  });

  it("reports the approval contract's issues beside the editor's own", async () => {
    const user = userEvent.setup();
    render(
      <ApprovalProvider>
        <ApprovalFormEditor initialSchema={NESTED_SUBFORM_SCHEMA} />
      </ApprovalProvider>
    );

    await user.click(await screen.findByTestId("footer-issues"));

    expect(await screen.findByText(/审批明细表仅支持单级/)).toBeInTheDocument();
  });

  describe("registries", () => {
    it("designs with the provider's approval profile by default", async () => {
      render(
        <ApprovalProvider>
          <ApprovalFormEditor />
        </ApprovalProvider>
      );

      const sidebar = await screen.findByRole("complementary", { name: "侧边栏" });

      expect(within(sidebar).getByText("文本框")).toBeInTheDocument();
      expect(within(sidebar).queryByText("开关")).not.toBeInTheDocument();
    });

    it("designs with registries passed explicitly", async () => {
      render(
        <ApprovalProvider>
          <ApprovalFormEditor registries={{ pc: createDefaultRegistry(), mobile: createDefaultMobileRegistry() }} />
        </ApprovalProvider>
      );

      const sidebar = await screen.findByRole("complementary", { name: "侧边栏" });

      expect(within(sidebar).getByText("开关")).toBeInTheDocument();
    });
  });
});
