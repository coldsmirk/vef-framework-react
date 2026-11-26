import type * as ComponentsModule from "@vef-framework-react/components";
import type { ScrollAreaProps } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { FormFieldRegistry } from "../../engine/registry/form-field-registry";
import type { FormEditorStoreApi } from "../../store/form-store";
import type { EntryType, FormField, FormSchema } from "../../types";
import type { EditorLayoutMode } from "../editor-layout-context";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { definePropertyEntry } from "../../types";
import { EditorLayoutProvider } from "../editor-layout-context";
import { PropertiesPanel } from "./properties-panel";

// Replace the Radix-backed ScrollArea with a passthrough so its props (notably
// the vertical-only `scrollbars` axis) are observable as plain DOM attributes —
// the real component renders custom scrollbars only under measured overflow,
// which jsdom never produces.
vi.mock("@vef-framework-react/components", async importOriginal => {
  const actual = await importOriginal<typeof ComponentsModule>();

  return {
    ...actual,
    ScrollArea: ({ children, ...props }: ScrollAreaProps) => (
      <div data-testid="properties-scroll-area" {...props}>
        {children}
      </div>
    )
  };
});

const FIELD_ID = "Field_1";

function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: FIELD_ID,
            type: "textfield",
            key: "name",
            label: "姓名"
          }
        ]
      }
    }
  };
}

function makeLinkageSchema(): FormSchema {
  const schema = makeSchema();

  schema.presentations.pc.children.push({
    id: "Field_2",
    type: "textfield",
    key: "note",
    label: "备注",
    linkage: {
      rules: [
        {
          id: "Rule_1",
          trigger: {
            kind: "condition",
            condition: {
              kind: "leaf",
              id: "Cond_1",
              sourceKey: "name",
              operator: "eq",
              value: "x"
            }
          },
          actions: [{ id: "Action_1", type: "show" }]
        }
      ]
    }
  });

  return schema;
}

interface PropertiesHarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
  selectId?: string;
}

function PropertiesHarness({ onReady, selectId }: PropertiesHarnessProps): ReactElement {
  const api = useFormEditorStoreApi();

  useEffect(() => {
    if (selectId) {
      api.getState().selectNode(selectId);
    }

    onReady(api);
  }, [api, onReady, selectId]);

  return <PropertiesPanel />;
}

function flexChildSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Flex_1",
            type: "flex",
            children: [
              {
                id: FIELD_ID,
                type: "textfield",
                key: "name",
                label: "姓名"
              }
            ]
          }
        ]
      }
    }
  };
}

function tableColumnSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Subform_1",
            type: "subform",
            variant: "table",
            key: "rows",
            label: "表格子表单",
            template: [
              {
                id: FIELD_ID,
                type: "textfield",
                key: "name",
                label: "姓名"
              }
            ]
          }
        ]
      }
    }
  };
}

function setupPropertiesPanel(
  selectId?: string,
  schema: FormSchema = makeSchema(),
  registry: FormFieldRegistry = createDefaultRegistry(),
  layout: EditorLayoutMode = "docked"
): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;

  render(
    <FormEditorStoreProvider initialState={{ schema }}>
      <RegistryProvider registries={{ pc: registry, mobile: createDefaultRegistry() }}>
        <EditorLayoutProvider value={layout}>
          <PropertiesHarness
            selectId={selectId}
            onReady={nextApi => {
              storeApi = nextApi;
            }}
          />
        </EditorLayoutProvider>
      </RegistryProvider>
    </FormEditorStoreProvider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return storeApi;
}

describe("PropertiesPanel", () => {
  describe("selection-driven tabs", () => {
    it("shows the 表单 tab with 控件 disabled when nothing is selected", () => {
      setupPropertiesPanel();

      expect(screen.getByRole("tab", { name: "表单" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "控件" })).toBeDisabled();
      expect(screen.getByLabelText("表单 ID")).toHaveValue("Form_1");
      expect(screen.getByLabelText("元素间距")).toBeInTheDocument();
      expect(screen.queryByText("未选择控件")).not.toBeInTheDocument();
      expect(screen.queryByText("字段数量")).not.toBeInTheDocument();
    });

    it("activates the 控件 tab when a field is selected", async () => {
      setupPropertiesPanel(FIELD_ID);

      expect(await screen.findByRole("button", { name: "取消选择" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "控件" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getAllByText("姓名").length).toBeGreaterThan(0);
    });

    it("reverts to the 表单 tab when the selection is cleared", async () => {
      const user = userEvent.setup();
      const storeApi = setupPropertiesPanel(FIELD_ID);

      await user.click(await screen.findByRole("button", { name: "取消选择" }));

      expect(storeApi.getState().selectedId).toBeNull();
      expect(storeApi.getState().propertiesTab).toBe("form");
      expect(screen.getByRole("tab", { name: "表单" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "控件" })).toBeDisabled();
      expect(screen.getByLabelText("表单 ID")).toHaveValue("Form_1");
    });

    it("allows switching to 表单 while a node is selected and switches back to 控件 on reselect", async () => {
      const user = userEvent.setup();
      const storeApi = setupPropertiesPanel(FIELD_ID);

      await screen.findByRole("button", { name: "取消选择" });
      await user.click(screen.getByRole("tab", { name: "表单" }));

      expect(storeApi.getState().selectedId).toBe(FIELD_ID);
      expect(storeApi.getState().propertiesTab).toBe("form");
      expect(screen.getByLabelText("表单 ID")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "控件" })).toBeEnabled();

      // Re-selecting a node switches back to the 控件 tab automatically.
      act(() => {
        storeApi.getState().selectNode(FIELD_ID);
      });

      expect(storeApi.getState().propertiesTab).toBe("control");
      expect(screen.getByRole("tab", { name: "控件" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("button", { name: "取消选择" })).toBeInTheDocument();
    });

    it("lists field linkage overview and form events on 表单, and opens the bearer's 联动 tab without opening a dialog", async () => {
      const user = userEvent.setup();
      const storeApi = setupPropertiesPanel(undefined, makeLinkageSchema());

      expect(screen.getByText("字段联动")).toBeInTheDocument();
      expect(screen.getByText("备注")).toBeInTheDocument();
      expect(screen.getByText(/1\s*条规则/)).toBeInTheDocument();
      expect(screen.getByText("表单事件")).toBeInTheDocument();
      expect(screen.getByText("还没有事件规则")).toBeInTheDocument();

      await user.click(screen.getByText("备注"));

      expect(storeApi.getState().selectedId).toBe("Field_2");
      expect(storeApi.getState().propertiesTab).toBe("control");
      expect(screen.getByRole("tab", { name: "控件" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: /联动/ })).toHaveAttribute("aria-selected", "true");
      expect(await screen.findByText("姓名 等于 x 时")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(storeApi.getState().pendingLinkageFocus).toBeNull();
    });

    it("selects a container and scrolls its linkage section into view when clicked in the 字段联动 overview", async () => {
      const user = userEvent.setup();
      const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");
      const schema = makeSchema();

      schema.presentations.pc.children.push({
        id: "Flex_1",
        type: "flex",
        children: [],
        linkage: {
          rules: [
            {
              id: "Rule_flex",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  id: "Cond_flex",
                  sourceKey: "name",
                  operator: "notEmpty"
                }
              },
              actions: [{ id: "Action_flex", type: "show" }]
            }
          ]
        }
      });

      const storeApi = setupPropertiesPanel(undefined, schema);

      await user.click(screen.getByText("弹性布局"));

      expect(storeApi.getState().selectedId).toBe("Flex_1");
      expect(storeApi.getState().propertiesTab).toBe("control");
      expect(screen.getByText("联动规则")).toBeInTheDocument();
      expect(screen.getByText("姓名 不为空 时")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(storeApi.getState().pendingLinkageFocus).toBeNull();
      expect(scrollSpy).toHaveBeenCalledWith({ block: "start" });
      scrollSpy.mockRestore();
    });
  });

  describe("drawer layout", () => {
    it("keeps 表单 reachable with nothing selected through the right-edge trigger", async () => {
      const user = userEvent.setup();
      const storeApi = setupPropertiesPanel(undefined, makeSchema(), createDefaultRegistry(), "drawer");

      expect(screen.queryByRole("complementary", { name: "属性" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "打开表单属性" }));

      expect(storeApi.getState().propertiesDrawerOpen).toBe(true);
      expect(storeApi.getState().propertiesTab).toBe("form");
      expect(screen.getByRole("complementary", { name: "属性" })).toBeInTheDocument();
      expect(screen.getByLabelText("表单 ID")).toHaveValue("Form_1");

      await user.click(screen.getByRole("button", { name: "收起属性面板" }));

      expect(storeApi.getState().propertiesDrawerOpen).toBe(false);
      expect(screen.queryByRole("complementary", { name: "属性" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "打开表单属性" })).toBeInTheDocument();
    });

    it("opens automatically on 控件 when a node is selected and collapses on clear", async () => {
      const user = userEvent.setup();
      const storeApi = setupPropertiesPanel(FIELD_ID, makeSchema(), createDefaultRegistry(), "drawer");

      expect(await screen.findByRole("complementary", { name: "属性" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "控件" })).toHaveAttribute("aria-selected", "true");

      await user.click(screen.getByRole("button", { name: "取消选择" }));

      expect(storeApi.getState().selectedId).toBeNull();
      expect(storeApi.getState().propertiesDrawerOpen).toBe(false);
      expect(screen.queryByRole("complementary", { name: "属性" })).not.toBeInTheDocument();
    });
  });

  it("constrains the properties body to vertical scrolling only", async () => {
    setupPropertiesPanel(FIELD_ID);

    // A horizontal scrollbar must never appear when a wide control (e.g. the
    // linkage script editor) renders — the panel is a vertical-only surface.
    expect(await screen.findByTestId("properties-scroll-area")).toHaveAttribute("scrollbars", "vertical");
  });

  it("appends a 布局 tab for a field inside a layout container", async () => {
    setupPropertiesPanel(FIELD_ID, flexChildSchema());

    expect(await screen.findByRole("tab", { name: "布局" })).toBeInTheDocument();
  });

  it("shows a 布局 tab with stack sizing for a field outside any layout container", async () => {
    const user = userEvent.setup();
    setupPropertiesPanel(FIELD_ID);

    // A root-level field lives in the document stack, so its layout tab offers
    // the stack sizing control (width / min / max / align).
    await user.click(await screen.findByRole("tab", { name: "布局" }));

    expect(screen.getByText("布局 · 宽度")).toBeInTheDocument();
  });

  it("shows flex sizing controls on the 布局 tab", async () => {
    const user = userEvent.setup();
    setupPropertiesPanel(FIELD_ID, flexChildSchema());

    await user.click(await screen.findByRole("tab", { name: "布局" }));

    expect(screen.getByText("布局 · 弹性占比")).toBeInTheDocument();
  });

  it("appends a 布局 tab for a field inside a table subform", async () => {
    setupPropertiesPanel(FIELD_ID, tableColumnSchema());

    expect(await screen.findByRole("tab", { name: "布局" })).toBeInTheDocument();
  });

  it("shows the column width control on the 布局 tab for a table subform column", async () => {
    const user = userEvent.setup();
    setupPropertiesPanel(FIELD_ID, tableColumnSchema());

    await user.click(await screen.findByRole("tab", { name: "布局" }));

    expect(screen.getByText("布局 · 列宽")).toBeInTheDocument();
  });

  describe("handleChange routing", () => {
    it("routes key edits through setFieldKey on commit", async () => {
      const user = userEvent.setup();
      const storeApi = setupPropertiesPanel(FIELD_ID);
      const keySpy = vi.spyOn(storeApi.getState(), "setFieldKey");
      const input = await screen.findByDisplayValue("name");

      // Draft-buffered: typing does not commit mid-edit, so the key's
      // sanitize/de-dup normalization never mangles the text under the cursor.
      await user.type(input, "x");

      expect(keySpy).not.toHaveBeenCalled();

      // Commit on Enter routes the whole value through setFieldKey.
      await user.keyboard("{Enter}");

      expect(keySpy).toHaveBeenCalledWith({ fieldId: FIELD_ID, key: "namex" });
      expect(storeApi.getState().schema.presentations.pc.children[0]).toMatchObject({ key: "namex" });
    });

    it("routes other entries through editField with a per-entry coalesce key", async () => {
      const user = userEvent.setup();
      const storeApi = setupPropertiesPanel(FIELD_ID);
      const editSpy = vi.spyOn(storeApi.getState(), "editField");
      const keySpy = vi.spyOn(storeApi.getState(), "setFieldKey");

      await user.type(await screen.findByDisplayValue("姓名"), "字");

      expect(keySpy).not.toHaveBeenCalled();
      // Per-entry coalescing: label-then-placeholder edits land as two undo
      // steps, while a keystroke run in one entry folds into one.
      expect(editSpy).toHaveBeenCalledWith(
        expect.objectContaining({ fieldId: FIELD_ID }),
        { coalesceKey: `field:${FIELD_ID}:label` }
      );
      expect(storeApi.getState().schema.presentations.pc.children[0]).toMatchObject({ label: "姓名字" });
    });
  });

  describe("degraded states", () => {
    it("shows the unknown-field-type hint when the type is not in the registry", async () => {
      const alien = {
        id: FIELD_ID,
        type: "alien",
        key: "x"
      } as unknown as FormField;
      const schema: FormSchema = {
        id: "Form_1",
        version: 2,
        presentations: { pc: { children: [alien] } }
      };

      setupPropertiesPanel(FIELD_ID, schema);

      expect(await screen.findByText("未知字段类型")).toBeInTheDocument();
      expect(screen.getByText(/未在当前 registry 中注册/)).toBeInTheDocument();
    });

    it("renders a warning box for an unregistered property entry type", async () => {
      const registry = createDefaultRegistry();
      const textfield = registry.get("textfield");

      if (!textfield) {
        throw new Error("textfield definition missing from the default registry");
      }

      registry.register({
        ...textfield,
        properties: [
          {
            id: "custom",
            label: "自定义",
            tab: "props",
            entries: [
              definePropertyEntry<FormField, unknown>({
                id: "magic",
                label: "魔法",
                type: "magic-editor" as EntryType,
                read: field => field.id,
                write: field => field
              })
            ]
          }
        ]
      });

      setupPropertiesPanel(FIELD_ID, makeSchema(), registry);

      expect(await screen.findByText(/未注册的属性编辑器/)).toBeInTheDocument();
      expect(screen.getByText(/magic-editor/)).toBeInTheDocument();
    });
  });

  describe("entry renderer resolution", () => {
    it("prefers an instance-registered renderer over the built-in fallback", async () => {
      const registry = createDefaultRegistry();
      registry.registerPropertyEntry("text", ({ entry }) => <div data-testid="custom-text-entry">{entry.label}</div>);

      setupPropertiesPanel(FIELD_ID, makeSchema(), registry);

      // Every text entry in the panel renders through the override.
      const overridden = await screen.findAllByTestId("custom-text-entry");

      expect(overridden.length).toBeGreaterThan(0);
    });
  });
});
