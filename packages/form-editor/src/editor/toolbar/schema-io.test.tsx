import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema } from "../../types";
import type { SchemaIoMode } from "./schema-io";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { SchemaIoModal } from "./schema-io";

interface VefMessageMock {
  success: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

function installVefMessage(): VefMessageMock {
  const message: VefMessageMock = {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  };

  (globalThis as { $vef?: unknown }).$vef = { message };

  return message;
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

/**
 * A structurally valid schema that imports cleanly.
 */
function validImport(): FormSchema {
  return {
    id: "Form_imported",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Field_a",
            type: "textfield",
            key: "title",
            label: "标题"
          }
        ]
      }
    }
  };
}

/**
 * Error severity: an unknown field type is structural breakage the renderer
 * cannot consume, so the import must reject.
 */
function errorImport(): unknown {
  return {
    id: "Form_bad",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Field_a",
            type: "made-up-widget"
          }
        ]
      }
    }
  };
}

/**
 * Warning-only: a select referencing a missing form-global data source is
 * dangling authoring state (`data_source_ref_unknown`) — it must round-trip.
 */
function warningImport(): FormSchema {
  return {
    id: "Form_warned",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Field_a",
            type: "select",
            key: "city",
            label: "城市",
            dataSource: { kind: "ref", dataSourceId: "missing-source" }
          }
        ]
      }
    }
  };
}

interface ModalSetup {
  storeApi: FormEditorStoreApi;
  onClose: ReturnType<typeof vi.fn>;
}

function setupModal(mode: SchemaIoMode): ModalSetup {
  let storeApi: FormEditorStoreApi | null = null;
  const onClose = vi.fn();
  const registries = { pc: createDefaultRegistry(), mobile: createDefaultRegistry() };

  function Harness(): ReactElement {
    const api = useFormEditorStoreApi();

    useEffect(() => {
      storeApi = api;
    }, [api]);

    return <SchemaIoModal mode={mode} onClose={onClose} />;
  }

  render(
    <FormEditorStoreProvider initialState={{ schema: makeSchema() }}>
      <RegistryProvider registries={registries}>
        <Harness />
      </RegistryProvider>
    </FormEditorStoreProvider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return { storeApi, onClose };
}

async function replaceImportText(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  const textarea = screen.getByRole("textbox");

  await user.clear(textarea);
  await user.click(textarea);
  await user.paste(text);
}

describe("SchemaIoModal", () => {
  describe("import", () => {
    it("shows a parse error and leaves the store untouched for invalid JSON", async () => {
      const user = userEvent.setup();
      const { onClose, storeApi } = setupModal("import");

      await replaceImportText(user, "{ not json");
      await user.click(screen.getByRole("button", { name: "应用" }));

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(storeApi.getState().schema.id).toBe("Form_1");
      expect(onClose).not.toHaveBeenCalled();
    });

    it("rejects an error-severity schema and leaves the store untouched", async () => {
      const user = userEvent.setup();
      const { onClose, storeApi } = setupModal("import");

      await replaceImportText(user, JSON.stringify(errorImport(), null, 2));
      await user.click(screen.getByRole("button", { name: "应用" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("made-up-widget");
      expect(storeApi.getState().schema.id).toBe("Form_1");
      expect(onClose).not.toHaveBeenCalled();
    });

    it("commits a warning-only schema and surfaces one warning toast", async () => {
      const message = installVefMessage();
      const user = userEvent.setup();
      const { onClose, storeApi } = setupModal("import");

      await replaceImportText(user, JSON.stringify(warningImport(), null, 2));
      await user.click(screen.getByRole("button", { name: "应用" }));

      expect(storeApi.getState().schema.id).toBe("Form_warned");
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(message.warning).toHaveBeenCalledTimes(1);
      expect(message.warning).toHaveBeenCalledWith(expect.stringContaining("1 条警告"));
      expect(message.warning).toHaveBeenCalledWith(expect.stringContaining("missing-source"));
    });

    it("commits a valid schema without any warning toast", async () => {
      const message = installVefMessage();
      const user = userEvent.setup();
      const { onClose, storeApi } = setupModal("import");

      await replaceImportText(user, JSON.stringify(validImport(), null, 2));
      await user.click(screen.getByRole("button", { name: "应用" }));

      expect(storeApi.getState().schema.id).toBe("Form_imported");
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(message.warning).not.toHaveBeenCalled();
    });

    it("keeps the seeded buffer when the schema changes in the background", () => {
      const { storeApi } = setupModal("import");

      act(() => {
        storeApi.getState().patchSchema({ id: "Form_changed" });
      });

      const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");

      expect(textarea.value).toContain("Form_1");
      expect(textarea.value).not.toContain("Form_changed");
    });
  });

  describe("export", () => {
    it("shows the current schema JSON", () => {
      setupModal("export");

      expect(screen.getByText(/"id": "Form_1"/)).toBeInTheDocument();
    });
  });
});
