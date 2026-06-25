import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { Block, FormSchema, TextfieldField } from "../../types";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DragDropProvider } from "@vef-framework-react/core";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { createDefaultMobileRegistry } from "../../engine/registry/defaults-mobile";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { Canvas } from "./canvas";
import { SubtreeDraggingContext } from "./canvas-field";

const FIELD_ID = "Field_1";

// The repo-wide idiom for a lint-clean no-op mock (see core/http/client.spec.ts).
const silence = Function.prototype as () => void;

function makeField(): TextfieldField {
  return {
    id: FIELD_ID,
    type: "textfield",
    key: "textfield",
    label: "文本框"
  };
}

function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [makeField()]
      }
    }
  };
}

function makeMobileSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [makeField()]
      },
      mobile: {
        children: [makeField()]
      }
    }
  };
}

function makeContainersSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Sec_1",
            type: "section",
            variant: "card",
            title: "基本信息",
            children: [
              {
                id: "Field_a",
                type: "textfield",
                key: "a",
                label: "字段A"
              }
            ]
          },
          {
            id: "Tabs_1",
            type: "tabs",
            tabs: [
              {
                id: "Tab_1",
                label: "第一页",
                children: []
              },
              {
                id: "Tab_2",
                label: "第二页",
                children: []
              }
            ]
          },
          {
            id: "Subform_1",
            type: "subform",
            variant: "stack",
            key: "lines",
            label: "明细",
            template: []
          },
          {
            id: "Flex_1",
            type: "flex",
            children: [
              {
                id: "Field_b",
                type: "textfield",
                key: "b",
                label: "字段B"
              }
            ]
          },
          {
            id: "Grid_1",
            type: "grid",
            children: [
              {
                id: "Field_c",
                type: "textfield",
                key: "c",
                label: "字段C"
              }
            ]
          }
        ]
      }
    }
  };
}

function tableSubformColumns(): Block[] {
  return [
    {
      id: "Col_name",
      type: "textfield",
      key: "name",
      label: "姓名",
      validate: { required: true }
    },
    {
      id: "Col_age",
      type: "number",
      key: "age",
      label: "年龄"
    }
  ];
}

function makeTableSubformSchema(): FormSchema {
  const subform: Block = {
    id: "Subform_T",
    type: "subform",
    variant: "table",
    key: "rows",
    label: "表格子表单",
    template: tableSubformColumns()
  };

  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: { children: [subform] },
      mobile: { children: [subform] }
    }
  };
}

interface CanvasHarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

function CanvasHarness({ onReady }: CanvasHarnessProps): ReactElement {
  const api = useFormEditorStoreApi();

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return <Canvas />;
}

interface SetupCanvasOptions {
  schema?: FormSchema;
  /**
   * Render the canvas inside an active {@link SubtreeDraggingContext}, as if an
   * ancestor block were travelling with the cursor.
   */
  subtreeDragging?: boolean;
}

function setupCanvas({ schema = makeSchema(), subtreeDragging = false }: SetupCanvasOptions = {}): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;
  const registry = createDefaultRegistry();
  const harness = (
    <CanvasHarness onReady={nextApi => {
      storeApi = nextApi;
    }}
    />
  );

  render(
    <FormEditorStoreProvider initialState={{ schema }}>
      <RegistryProvider registries={{ pc: registry, mobile: createDefaultMobileRegistry() }}>
        <DragDropProvider>
          {subtreeDragging
            ? <SubtreeDraggingContext value>{harness}</SubtreeDraggingContext>
            : harness}
        </DragDropProvider>
      </RegistryProvider>
    </FormEditorStoreProvider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return storeApi;
}

describe("Canvas", () => {
  it("renders a live, interactive field preview in PC edit mode", () => {
    setupCanvas();

    // PC previews are not disabled, so a designer can open a Select to see its
    // data-source options (or type into an input) without leaving the canvas.
    expect(screen.getByRole("textbox", { name: "文本框" })).toBeEnabled();
  });

  it("wraps the leaf preview in an interactive offscreen-skip shield", () => {
    setupCanvas();

    // The shield is the content-visibility boundary for big forms. It does NOT
    // lift pointer events: the live control handles the click while selection
    // rides the bubbling up to the wrapper. The shield and wrapper are unlabeled
    // structural elements, reachable only through their documented data
    // attributes — hence the node-access exemptions.

    const shield = screen.getByRole("textbox", { name: "文本框" }).closest("[data-canvas-shield]");

    expect(shield).not.toBeNull();
    expect(shield).not.toHaveStyle({ pointerEvents: "none" });

    expect(shield?.closest("[data-canvas-field]")).not.toBeNull();
  });

  it("renders a live, interactive field preview in mobile edit mode too", () => {
    const storeApi = setupCanvas({ schema: makeMobileSchema() });

    // Mobile previews are live as well: a tapped picker opens uncontained (a
    // body-portaled sheet) that the user dismisses to resume dragging — a normal
    // modal flow — so the edit canvas needs no drag-breaking containment
    // transform and the control stays interactive.
    act(() => {
      storeApi.getState().setDevice("mobile");
    });

    expect(screen.getByRole("textbox", { name: "文本框" })).toBeEnabled();

    const shield = screen.getByRole("textbox", { name: "文本框" }).closest("[data-canvas-shield]");
    expect(shield).not.toHaveStyle({ pointerEvents: "none" });
  });

  it("selects the field when its card is clicked", async () => {
    const user = userEvent.setup();
    const storeApi = setupCanvas();

    const wrapper = screen.getByRole("textbox", { name: "文本框" }).closest("[data-canvas-field]");
    await user.click(wrapper as HTMLElement);

    expect(storeApi.getState().selectedId).toBe(FIELD_ID);
  });

  it("renders the live runtime form in preview mode", async () => {
    const user = userEvent.setup();
    const storeApi = setupCanvas();

    act(() => {
      storeApi.getState().setViewMode("preview");
    });

    const input = screen.getByRole("textbox", { name: "文本框" });
    await user.type(input, "hello");

    expect(input).toHaveValue("hello");
  });

  it("does not mutate the schema while editing a preview value", async () => {
    const user = userEvent.setup();
    const storeApi = setupCanvas();
    const before = storeApi.getState().schema;

    act(() => {
      storeApi.getState().setViewMode("preview");
    });

    await user.type(screen.getByRole("textbox", { name: "文本框" }), "hi");

    expect(storeApi.getState().schema).toBe(before);
  });

  it("renders the JSON split view in json mode", async () => {
    const storeApi = setupCanvas();

    act(() => {
      storeApi.getState().setViewMode("json");
    });

    // The JSON workbench is a lazy chunk — it streams in after the switch.
    expect(await screen.findByText("Schema JSON")).toBeInTheDocument();
    expect(screen.getByText("预览")).toBeInTheDocument();
  });

  it("shows the empty drop target when the form has no blocks", () => {
    setupCanvas({
      schema: {
        id: "Form_1",
        version: 2,
        presentations: { pc: { children: [] } }
      }
    });

    expect(screen.getByText("从左侧拖入组件，或双击组件追加到此处")).toBeInTheDocument();
  });

  describe("container previews", () => {
    it("renders every container type with its chrome and nested fields", () => {
      setupCanvas({ schema: makeContainersSchema() });

      expect(screen.getByText("基本信息")).toBeInTheDocument();
      expect(screen.getByText("第一页")).toBeInTheDocument();
      expect(screen.getByText("第二页")).toBeInTheDocument();
      expect(screen.getByText("明细")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "字段A" })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "字段B" })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "字段C" })).toBeInTheDocument();
    });
  });

  describe("table subform preview", () => {
    it("renders each keyed leaf template field as a column on PC", () => {
      setupCanvas({ schema: makeTableSubformSchema() });

      expect(screen.getByText("姓名")).toBeInTheDocument();
      expect(screen.getByText("年龄")).toBeInTheDocument();
      // The trailing affordance that only the table chrome draws.
      expect(screen.getByText("拖入列")).toBeInTheDocument();
    });

    it("renders a disabled sample editor per column on PC", () => {
      setupCanvas({ schema: makeTableSubformSchema() });

      // The 年龄 column's sample cell is a disabled number control.
      expect(screen.getByRole("spinbutton")).toBeDisabled();
    });

    it("falls back to the stacked layout on mobile", () => {
      const storeApi = setupCanvas({ schema: makeTableSubformSchema() });

      act(() => {
        storeApi.getState().setDevice("mobile");
      });

      // The column table chrome is PC-only; mobile renders the subform stacked.
      expect(screen.queryByText("拖入列")).not.toBeInTheDocument();
    });

    it("pins a column to its fixed columnWidth on PC", () => {
      const subform: Block = {
        id: "Subform_T",
        type: "subform",
        variant: "table",
        key: "rows",
        label: "表格子表单",
        template: [
          {
            id: "Col_name",
            type: "textfield",
            key: "name",
            label: "姓名"
          },
          {
            id: "Col_age",
            type: "number",
            key: "age",
            label: "年龄",
            columnWidth: 200
          }
        ]
      };
      setupCanvas({
        schema: {
          id: "Form_1",
          version: 2,
          presentations: { pc: { children: [subform] } }
        }
      });

      const cell = screen.getByText("年龄").closest("div[style*=\"width\"]");
      expect(cell).toHaveStyle({ width: "200px" });
    });
  });

  describe("drop zones", () => {
    it("renders an insertion zone per stacked block", () => {
      setupCanvas();

      expect(screen.getAllByTestId("drop-zone")).toHaveLength(1);
    });

    it("renders no zones while an ancestor block is being dragged", () => {
      setupCanvas({ subtreeDragging: true });

      // The whole body is inside the drag ghost: every precise zone disappears
      // so no stray indicator can mark an invalid self-drop.
      expect(screen.queryAllByTestId("drop-zone")).toHaveLength(0);
    });
  });

  describe("mobile seed state", () => {
    it("offers conversion and blank start while mobile is undesigned", () => {
      const storeApi = setupCanvas();

      act(() => {
        storeApi.getState().setDevice("mobile");
      });

      expect(screen.getByText("移动端布局尚未设计")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /从 PC 转换/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "从空白开始" })).toBeInTheDocument();
    });

    it("seeds an empty mobile layer from the blank-start action", async () => {
      const user = userEvent.setup();
      const storeApi = setupCanvas();

      act(() => {
        storeApi.getState().setDevice("mobile");
      });

      await user.click(screen.getByRole("button", { name: "从空白开始" }));

      expect(storeApi.getState().schema.presentations.mobile).toEqual({ children: [] });
      expect(storeApi.getState().device).toBe("mobile");
      // The seed screen gives way to the regular empty drop target.
      expect(screen.queryByText("移动端布局尚未设计")).not.toBeInTheDocument();
      expect(screen.getByText("从左侧拖入组件，或双击组件追加到此处")).toBeInTheDocument();
    });

    it("seeds a converted mobile layer from the PC design", async () => {
      const user = userEvent.setup();
      const storeApi = setupCanvas();

      act(() => {
        storeApi.getState().setDevice("mobile");
      });

      await user.click(screen.getByRole("button", { name: /从 PC 转换/ }));

      const { children } = storeApi.getState().schema.presentations.mobile ?? { children: [] };
      expect(children).toHaveLength(1);
      expect(children[0]).toMatchObject({ type: "textfield", key: "textfield" });
      // The conversion regenerates ids so the trees never share node identity.
      expect(children[0]?.id).not.toBe(FIELD_ID);
    });

    it("details the casualties of a lossy conversion", async () => {
      // A type the mobile registry does not know (and no rule degrades) is
      // dropped; the report must reach the designer (info dialog, console
      // fallback in tests), not vanish behind a bare count toast.
      const alien = {
        id: "Field_alien",
        type: "alien",
        key: "alien",
        label: "外星组件"
      } as unknown as TextfieldField;
      const info = vi.spyOn(console, "info").mockImplementation(silence);
      const user = userEvent.setup();
      const storeApi = setupCanvas({
        schema: {
          id: "Form_1",
          version: 2,
          presentations: {
            pc: {
              children: [makeField(), alien]
            }
          }
        }
      });

      act(() => {
        storeApi.getState().setDevice("mobile");
      });

      await user.click(screen.getByRole("button", { name: /从 PC 转换/ }));

      expect(info).toHaveBeenCalledWith(
        "[form-editor]",
        expect.stringContaining("1 个无法转换")
      );

      info.mockRestore();
    });
  });

  describe("when the blank surface is clicked", () => {
    it("clears the current selection", async () => {
      const user = userEvent.setup();
      const storeApi = setupCanvas();

      act(() => {
        storeApi.getState().selectNode(FIELD_ID);
      });
      expect(storeApi.getState().selectedId).toBe(FIELD_ID);

      await user.click(getSurface());

      expect(storeApi.getState().selectedId).toBeNull();
    });

    it("does not open any panel when nothing is selected", async () => {
      const user = userEvent.setup();
      const storeApi = setupCanvas();

      await user.click(getSurface());

      expect(storeApi.getState().selectedId).toBeNull();
      expect(storeApi.getState().formConfigOpen).toBe(false);
    });
  });
});

function getSurface(): HTMLElement {
  return screen.getByTestId("canvas-surface");
}
