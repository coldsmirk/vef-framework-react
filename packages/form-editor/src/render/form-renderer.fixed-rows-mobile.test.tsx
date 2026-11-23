import type { FormSchema, SubformNode } from "../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { createDefaultMobileRegistry } from "../engine/registry/defaults-mobile";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";

describe("FormRenderer mobile fixed-row subform", () => {
  it("renders titled cards on mobile without add or delete controls and preserves item snapshots on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const subform: SubformNode = {
      id: "Sub_mobile",
      type: "subform",
      variant: "table",
      key: "checks",
      label: "移动端自查",
      rows: {
        mode: "fixed",
        itemKey: "item",
        headerLabel: "自查内容",
        source: {
          kind: "static",
          options: [
            { label: "移动端条款一", value: "m1" },
            { label: "移动端条款二", value: "m2" }
          ]
        }
      },
      template: [
        {
          id: "Field_note",
          type: "textfield",
          key: "note",
          label: "整改措施"
        }
      ]
    };
    const schema: FormSchema = {
      id: "Form_mobile_fixed",
      version: 2,
      presentations: {
        pc: { children: [] },
        mobile: {
          children: [
            subform,
            {
              id: "Field_submit",
              type: "button",
              label: "提交",
              action: "submit"
            }
          ]
        }
      }
    };

    render(
      <RegistryProvider registries={{ pc: createDefaultRegistry(), mobile: createDefaultMobileRegistry() }}>
        <FormRenderer device="mobile" schema={schema} onSubmit={onSubmit} />
      </RegistryProvider>
    );

    expect(screen.getByText("移动端条款一")).toBeInTheDocument();
    expect(screen.getByText("移动端条款二")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新增/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument();

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[1] as HTMLElement, "限期整改");
    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(onSubmit).toHaveBeenCalledWith({
      checks: [
        { item: { value: "m1", label: "移动端条款一" }, note: "" },
        { item: { value: "m2", label: "移动端条款二" }, note: "限期整改" }
      ]
    });
  });
});
