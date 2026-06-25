import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema } from "../../types";
import type { EditorLayoutMode } from "../editor-layout-context";

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, selectFieldCount, useFormEditorStoreApi } from "../../store/form-store";
import { EditorLayoutProvider } from "../editor-layout-context";
import { Toolbar } from "./toolbar";

interface VefMock {
  message: {
    success: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  modal: {
    confirm: ReturnType<typeof vi.fn>;
  };
}

function installVefGlobal(): VefMock {
  const vef: VefMock = {
    message: {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn()
    },
    modal: {
      confirm: vi.fn()
    }
  };

  (globalThis as { $vef?: unknown }).$vef = vef;

  return vef;
}

afterEach(() => {
  delete (globalThis as { $vef?: unknown }).$vef;
});

function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Field_1",
            type: "textfield",
            key: "name",
            label: "姓名"
          }
        ]
      }
    }
  };
}

function emptySchema(): FormSchema {
  return {
    id: "Form_empty",
    version: 2,
    presentations: { pc: { children: [] } }
  };
}

/**
 * A well-formed schema carrying one warning-severity issue: the rule's
 * condition references a key no field provides (`source_key_unresolved`).
 */
function warningSchema(): FormSchema {
  return {
    id: "Form_warn",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Field_1",
            type: "textfield",
            key: "name",
            label: "姓名",
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: {
                    kind: "condition",
                    condition: {
                      kind: "group",
                      id: "Cond_g",
                      logic: "all",
                      children: [
                        {
                          kind: "leaf",
                          id: "Cond_l",
                          sourceKey: "ghost",
                          operator: "eq",
                          value: "1"
                        }
                      ]
                    }
                  },
                  actions: [{ id: "Action_1", type: "show" }]
                }
              ]
            }
          }
        ]
      }
    }
  };
}

interface ToolbarSetup {
  storeApi: FormEditorStoreApi;
  onPublish: ReturnType<typeof vi.fn>;
}

function setupToolbar(options: { layout?: EditorLayoutMode; schema?: FormSchema; withoutPublish?: boolean } = {}): ToolbarSetup {
  let storeApi: FormEditorStoreApi | null = null;
  const onPublish = vi.fn();

  function Harness(): ReactElement {
    const api = useFormEditorStoreApi();

    useEffect(() => {
      storeApi = api;
    }, [api]);

    return <Toolbar onPublish={options.withoutPublish ? undefined : onPublish} />;
  }

  render(
    <FormEditorStoreProvider initialState={{ schema: options.schema ?? makeSchema() }}>
      <RegistryProvider registries={{ pc: createDefaultRegistry(), mobile: createDefaultRegistry() }}>
        <EditorLayoutProvider value={options.layout ?? "docked"}>
          <Harness />
        </EditorLayoutProvider>
      </RegistryProvider>
    </FormEditorStoreProvider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return { storeApi, onPublish };
}

describe("Toolbar", () => {
  describe("history controls", () => {
    it("disables undo and redo while both stacks are empty", () => {
      setupToolbar();

      expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "重做" })).toBeDisabled();
    });

    it("enables undo after an edit and redo after an undo", () => {
      const { storeApi } = setupToolbar();

      act(() => {
        storeApi.getState().patchSchema({ id: "Form_renamed" });
      });

      expect(screen.getByRole("button", { name: "撤销" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "重做" })).toBeDisabled();

      act(() => {
        storeApi.getState().undo();
      });

      expect(screen.getByRole("button", { name: "重做" })).toBeEnabled();
    });

    it("dispatches undo through the store when clicked", async () => {
      const user = userEvent.setup();
      const { storeApi } = setupToolbar();

      act(() => {
        storeApi.getState().patchSchema({ id: "Form_renamed" });
      });

      await user.click(screen.getByRole("button", { name: "撤销" }));

      expect(storeApi.getState().schema.id).toBe("Form_1");
    });
  });

  describe("device switch", () => {
    it("switches the editing device", async () => {
      const user = userEvent.setup();
      const { storeApi } = setupToolbar();

      await user.click(screen.getByRole("button", { name: "Mobile" }));
      expect(storeApi.getState().device).toBe("mobile");

      await user.click(screen.getByRole("button", { name: "PC" }));
      expect(storeApi.getState().device).toBe("pc");
    });
  });

  describe("view-mode toggles", () => {
    it("marks the active mode pressed", () => {
      setupToolbar();

      expect(screen.getByRole("button", { name: "编辑" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "预览" })).toHaveAttribute("aria-pressed", "false");
    });

    it("switches into preview mode", async () => {
      const user = userEvent.setup();
      const { storeApi } = setupToolbar();

      await user.click(screen.getByRole("button", { name: "预览" }));

      expect(storeApi.getState().viewMode).toBe("preview");
      expect(screen.getByRole("button", { name: "预览" })).toHaveAttribute("aria-pressed", "true");
    });

    it("switches into json mode and back to edit", async () => {
      const user = userEvent.setup();
      const { storeApi } = setupToolbar();

      await user.click(screen.getByRole("button", { name: "JSON" }));
      expect(storeApi.getState().viewMode).toBe("json");

      await user.click(screen.getByRole("button", { name: "编辑" }));
      expect(storeApi.getState().viewMode).toBe("edit");
    });
  });

  describe("clear", () => {
    it("clears the schema after the confirm dialog is accepted", async () => {
      const vef = installVefGlobal();
      const user = userEvent.setup();
      const { storeApi } = setupToolbar();

      await user.click(screen.getByRole("button", { name: "清空" }));

      expect(vef.modal.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "确认清空当前表单？" }));
      expect(selectFieldCount(storeApi.getState())).toBe(1);

      const { onOk } = vef.modal.confirm.mock.calls[0]![0] as { onOk: () => void };

      act(() => {
        onOk();
      });

      expect(selectFieldCount(storeApi.getState())).toBe(0);
    });

    it("notifies instead of confirming when the form is already empty", async () => {
      const vef = installVefGlobal();
      const user = userEvent.setup();
      setupToolbar({ schema: emptySchema() });

      await user.click(screen.getByRole("button", { name: "清空" }));

      expect(vef.message.success).toHaveBeenCalledWith("当前表单已为空");
      expect(vef.modal.confirm).not.toHaveBeenCalled();
    });
  });

  describe("fields summary", () => {
    it("shows the field count for the active device", () => {
      setupToolbar();

      expect(
        screen.getByText((_, node) => node?.tagName === "SPAN" && node.textContent === "1 字段")
      ).toBeInTheDocument();
    });
  });

  describe("publish", () => {
    it("invokes the host publish hook with the current schema", async () => {
      const user = userEvent.setup();
      const { onPublish, storeApi } = setupToolbar();

      await user.click(screen.getByRole("button", { name: "发布" }));

      expect(onPublish).toHaveBeenCalledTimes(1);
      expect(onPublish).toHaveBeenCalledWith(storeApi.getState().schema);
    });

    it("renders no publish button without a publish hook", () => {
      // Publishing is host semantics; with no hook the CTA would be a dead
      // button (or worse, a fake success), so it is not rendered at all.
      setupToolbar({ withoutPublish: true });

      expect(screen.queryByRole("button", { name: "发布" })).not.toBeInTheDocument();
    });

    it("asks for confirmation when the schema has validation warnings", async () => {
      const vef = installVefGlobal();
      const user = userEvent.setup();
      const { onPublish } = setupToolbar({ schema: warningSchema() });

      await user.click(screen.getByRole("button", { name: "发布" }));

      // The dangling rule source surfaces as a warning confirm instead of a
      // silent publish; confirming still hands the schema to the host.
      expect(onPublish).not.toHaveBeenCalled();
      expect(vef.modal.confirm).toHaveBeenCalledTimes(1);

      const config = vef.modal.confirm.mock.calls[0]?.[0] as { onOk?: () => void };
      config.onOk?.();

      expect(onPublish).toHaveBeenCalledTimes(1);
    });
  });

  describe("condensed more menu", () => {
    it("hides the inline io actions and opens schema export from the menu", async () => {
      const user = userEvent.setup();
      setupToolbar({ layout: "drawer" });

      expect(screen.queryByRole("button", { name: "导出" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "更多操作" }));
      await user.click(await screen.findByText("导出 Schema"));

      const dialog = await screen.findByRole("dialog");

      expect(within(dialog).getByText("导出 Schema")).toBeInTheDocument();
    });

    it("routes the menu clear action through the confirm dialog", async () => {
      const vef = installVefGlobal();
      const user = userEvent.setup();
      setupToolbar({ layout: "drawer" });

      await user.click(screen.getByRole("button", { name: "更多操作" }));
      await user.click(await screen.findByText("清空表单"));

      expect(vef.modal.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "确认清空当前表单？" }));
    });
  });
});
