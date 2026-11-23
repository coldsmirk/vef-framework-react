import type * as ComponentsModule from "@vef-framework-react/components";
import type { ScrollAreaProps } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema, SubformNode } from "../../types";

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { ContainerProperties } from "./container-properties";

vi.mock("@vef-framework-react/components", async importOriginal => {
  const actual = await importOriginal<typeof ComponentsModule>();

  return {
    ...actual,
    ScrollArea: ({ children, ...props }: ScrollAreaProps) => (
      <div data-testid="container-properties-scroll-area" {...props}>
        {children}
      </div>
    )
  };
});

const SUBFORM_ID = "Sub_1";

function subformNode(overrides: Partial<SubformNode> = {}): SubformNode {
  return {
    id: SUBFORM_ID,
    type: "subform",
    variant: "stack",
    key: "lines",
    label: "明细",
    template: [],
    ...overrides
  };
}

function makeSchema(subform: SubformNode, mobileSubform?: SubformNode): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: { children: [subform] },
      ...mobileSubform && { mobile: { children: [mobileSubform] } }
    }
  };
}

interface HarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

/**
 * Renders the subform node read live from the store so updateBlock commits
 * round-trip into the controls, as in the real panel.
 */
function Harness({ onReady }: HarnessProps): ReactElement | null {
  const api = useFormEditorStoreApi();
  const node = useFormEditorStore(state => state.schema.presentations.pc.children.find(block => block.id === SUBFORM_ID));

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  if (!node || node.type !== "subform") {
    return null;
  }

  return <ContainerProperties node={node} parent={undefined} onClose={vi.fn()} />;
}

function setup(subform: SubformNode, mobileSubform?: SubformNode): FormEditorStoreApi {
  let captured: FormEditorStoreApi | null = null;

  render(
    <FormEditorStoreProvider initialState={{ schema: makeSchema(subform, mobileSubform) }}>
      <Harness
        onReady={api => {
          captured = api;
        }}
      />
    </FormEditorStoreProvider>
  );

  if (!captured) {
    throw new Error("Form store API was not captured");
  }

  return captured;
}

function storeSubform(api: FormEditorStoreApi): SubformNode {
  const node = api.getState().schema.presentations.pc.children.find(block => block.id === SUBFORM_ID);

  if (!node || node.type !== "subform") {
    throw new Error("subform node missing from the store schema");
  }

  return node;
}

describe("ContainerProperties", () => {
  it("constrains the panel body to vertical scrolling only", () => {
    setup(subformNode());

    expect(screen.getByTestId("container-properties-scroll-area")).toHaveAttribute("scrollbars", "vertical");
  });

  describe("subform", () => {
    it("shows the binding key read-only", () => {
      setup(subformNode());

      const keyInput = screen.getByDisplayValue("lines");
      expect(keyInput).toBeDisabled();
      expect(screen.getByText(/暂不支持在此修改/)).toBeInTheDocument();
    });

    it("clamps a minimum above the current maximum down to it", async () => {
      const user = userEvent.setup();
      const api = setup(subformNode({ rows: { mode: "dynamic", max: 5 } }));

      const minRowsRow = screen.getByText("最少行数").closest("div") as HTMLElement;
      await user.type(within(minRowsRow).getByRole("spinbutton"), "9");
      await user.tab();

      expect(storeSubform(api).rows).toEqual({
        mode: "dynamic",
        min: 5,
        max: 5
      });
    });

    it("clamps a maximum below the current minimum up to it", async () => {
      const user = userEvent.setup();
      const api = setup(subformNode({ rows: { mode: "dynamic", min: 4 } }));

      const maxRowsRow = screen.getByText("最多行数").closest("div") as HTMLElement;
      await user.type(within(maxRowsRow).getByRole("spinbutton"), "2");
      await user.tab();

      expect(storeSubform(api).rows).toEqual({
        mode: "dynamic",
        min: 4,
        max: 4
      });
    });

    it("switches between dynamic and fixed row modes and avoids template key collisions", async () => {
      const user = userEvent.setup();
      const api = setup(subformNode({
        template: [
          {
            id: "Col_1",
            type: "textfield",
            key: "item",
            label: "已有列"
          }
        ]
      }));

      await user.click(screen.getByText("固定行"));

      expect(storeSubform(api).rows).toMatchObject({
        mode: "fixed",
        itemKey: "item_2",
        headerLabel: "检查项",
        source: { kind: "static" }
      });

      expect(screen.getByText("行项目来源")).toBeInTheDocument();
      expect(screen.queryByText("最少行数")).not.toBeInTheDocument();

      await user.click(screen.getByText("动态行"));
      await user.click(await screen.findByRole("button", { name: /切\s*换/ }));

      expect(storeSubform(api).rows).toEqual({ mode: "dynamic", addLabel: "新增一行" });
      expect(screen.getByText("最少行数")).toBeInTheDocument();
    });

    it("shows headerWidth only for fixed-row table subforms on PC", () => {
      setup(subformNode({
        variant: "table",
        rows: {
          mode: "fixed",
          itemKey: "item",
          headerLabel: "自查内容",
          source: { kind: "static", options: [{ label: "项1", value: "1" }] }
        }
      }));

      expect(screen.getByText("行头列宽 (px)")).toBeInTheDocument();
    });

    it("renders the container linkage section", () => {
      setup(subformNode());

      expect(screen.getByText("联动规则")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /新建联动规则/ })).toBeInTheDocument();
    });

    it("renders the long property body inside the scroll viewport", () => {
      setup(subformNode());

      expect(screen.getByTestId("container-properties-scroll-area")).toHaveTextContent("联动规则");
    });

    it("shows the layout control in PC design mode", () => {
      setup(subformNode());

      expect(screen.getByText("布局")).toBeInTheDocument();
    });

    it("hides the layout control in mobile design mode", () => {
      const api = setup(subformNode());

      act(() => {
        api.getState().setDevice("mobile");
      });

      expect(screen.queryByText("布局")).not.toBeInTheDocument();
    });

    it("keeps the free-layout gap control in mobile design mode", () => {
      const api = setup(subformNode());

      act(() => {
        api.getState().setDevice("mobile");
      });

      expect(screen.getByText("子元素间距")).toBeInTheDocument();
    });

    it("syncs row mode, itemKey, and required edits to the mobile twin while leaving headerLabel device-local", async () => {
      const user = userEvent.setup();
      const pcSubform = subformNode({ variant: "table" });
      const mobileSubform = subformNode({
        id: "M_Sub_1",
        variant: "stack",
        label: "移动端明细"
      });
      const api = setup(pcSubform, mobileSubform);

      // Switch PC from dynamic to fixed -> mobile switches to fixed without copying PC's headerLabel.
      await user.click(screen.getByText("固定行"));

      const mobileAfterFixed = api.getState().schema.presentations.mobile?.children[0] as SubformNode;
      expect(mobileAfterFixed.variant).toBe("stack");
      expect(mobileAfterFixed.rows).toMatchObject({
        mode: "fixed",
        itemKey: "item",
        required: true,
        source: { kind: "static" }
      });
      expect(mobileAfterFixed.rows?.mode === "fixed" ? mobileAfterFixed.rows.headerLabel : undefined).toBeUndefined();

      // Edit PC headerLabel (presentation-only) -> mobile layer reference stays untouched.
      const mobileBeforeHeaderEdit = api.getState().schema.presentations.mobile;
      const headerLabelRow = screen.getByText("行头列标题").closest("div") as HTMLElement;
      await user.type(within(headerLabelRow).getByRole("textbox"), "补充");
      expect(api.getState().schema.presentations.mobile).toBe(mobileBeforeHeaderEdit);

      // Edit PC itemKey -> mobile twin follows.
      const itemKeyRow = screen.getByText("行项目 Key (itemKey)").closest("div") as HTMLElement;
      const itemKeyInput = within(itemKeyRow).getByRole("textbox");
      await user.clear(itemKeyInput);
      await user.type(itemKeyInput, "clause{Enter}");

      const mobileAfterItemKey = api.getState().schema.presentations.mobile?.children[0] as SubformNode;
      expect(mobileAfterItemKey.rows?.mode === "fixed" ? mobileAfterItemKey.rows.itemKey : undefined).toBe("clause");
    });
  });
});
