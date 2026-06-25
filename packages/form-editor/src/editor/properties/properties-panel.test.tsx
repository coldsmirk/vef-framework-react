import type * as ComponentsModule from "@vef-framework-react/components";
import type { ScrollAreaProps } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { FormFieldRegistry } from "../../engine/registry/form-field-registry";
import type { FormEditorStoreApi } from "../../store/form-store";
import type { EntryType, FormField, FormSchema } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { definePropertyEntry } from "../../types";
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

function getStoreApi(storeApi: FormEditorStoreApi | null): FormEditorStoreApi {
  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return storeApi;
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
  registry: FormFieldRegistry = createDefaultRegistry()
): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;

  render(
    <FormEditorStoreProvider initialState={{ schema }}>
      <RegistryProvider registries={{ pc: registry, mobile: createDefaultRegistry() }}>
        <PropertiesHarness
          selectId={selectId}
          onReady={nextApi => {
            storeApi = nextApi;
          }}
        />
      </RegistryProvider>
    </FormEditorStoreProvider>
  );

  return getStoreApi(storeApi);
}

describe("PropertiesPanel", () => {
  it("shows an empty hint when nothing is selected", () => {
    setupPropertiesPanel();

    // The dock is permanent now: with no selection it shows a placeholder, not
    // any control properties (form-level config lives in the bottom drawer).
    expect(screen.getByText("未选择控件")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消选择" })).not.toBeInTheDocument();
    expect(screen.queryByText("姓名")).not.toBeInTheDocument();
  });

  it("shows the selected field's properties", async () => {
    setupPropertiesPanel(FIELD_ID);

    expect(await screen.findByRole("button", { name: "取消选择" })).toBeInTheDocument();
    expect(screen.getAllByText("姓名").length).toBeGreaterThan(0);
  });

  it("constrains the properties body to vertical scrolling only", async () => {
    setupPropertiesPanel(FIELD_ID);

    // A horizontal scrollbar must never appear when a wide control (e.g. the
    // linkage script editor) renders — the panel is a vertical-only surface.
    expect(await screen.findByTestId("properties-scroll-area")).toHaveAttribute("scrollbars", "vertical");
  });

  it("deselects the field when the deselect button is clicked", async () => {
    const user = userEvent.setup();
    const storeApi = setupPropertiesPanel(FIELD_ID);

    await user.click(await screen.findByRole("button", { name: "取消选择" }));

    expect(storeApi.getState().selectedId).toBeNull();
  });

  it("appends a 布局 tab for a field inside a layout container", async () => {
    setupPropertiesPanel(FIELD_ID, flexChildSchema());

    expect(await screen.findByRole("tab", { name: "布局" })).toBeInTheDocument();
  });

  it("omits the 布局 tab for a field outside any layout container", async () => {
    setupPropertiesPanel(FIELD_ID);

    // Wait for the panel to render its tabs before asserting absence.
    expect(await screen.findByRole("tab", { name: "属性" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "布局" })).not.toBeInTheDocument();
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
