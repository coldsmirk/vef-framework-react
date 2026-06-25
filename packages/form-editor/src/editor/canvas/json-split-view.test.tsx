import type * as ComponentsModule from "@vef-framework-react/components";
import type { CodeEditorProps } from "@vef-framework-react/components";
import type { ChangeEvent, ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema } from "../../types";
import type { PreviewRuntime } from "../preview-runtime-context";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { JsonSplitView } from "./json-split-view";

vi.mock("@vef-framework-react/components", async importOriginal => {
  const actual = await importOriginal<typeof ComponentsModule>();

  // CodeMirror does not run under jsdom; a textarea stand-in keeps the
  // value/onChange contract (the established boundary mock).
  function CodeEditor(props: CodeEditorProps): ReactElement {
    return (
      <textarea
        aria-label="schema-json"
        value={props.value ?? ""}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => props.onChange?.(event.target.value)}
      />
    );
  }

  return { ...actual, CodeEditor };
});

function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "F",
            type: "textfield",
            key: "name",
            label: "姓名"
          }
        ]
      }
    }
  };
}

function setupView(schema: FormSchema = makeSchema(), runtime?: PreviewRuntime): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;
  const registry = createDefaultRegistry();

  function Bridge(): ReactElement {
    const api = useFormEditorStoreApi();
    const liveSchema = useFormEditorStore(s => s.schema);

    useEffect(() => {
      storeApi = api;
    }, [api]);

    return <JsonSplitView device="pc" runtime={runtime} schema={liveSchema} />;
  }

  render(
    <FormEditorStoreProvider initialState={{ schema }}>
      <RegistryProvider registries={{ pc: registry, mobile: registry }}>
        <Bridge />
      </RegistryProvider>
    </FormEditorStoreProvider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return storeApi;
}

async function replaceBuffer(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  const buffer = screen.getByLabelText("schema-json");

  await user.clear(buffer);
  await user.click(buffer);
  await user.paste(text);
}

describe("JsonSplitView", () => {
  it("shows the schema JSON on the left", () => {
    setupView();

    expect((screen.getByLabelText("schema-json") as HTMLTextAreaElement).value).toContain("\"name\"");
  });

  it("renders a live form preview on the right", () => {
    setupView();

    expect(screen.getByRole("textbox", { name: "姓名" })).toBeInTheDocument();
  });

  it("offers copy and download actions", () => {
    setupView();

    expect(screen.getByRole("button", { name: /复制/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /下载/ })).toBeInTheDocument();
  });

  it("forwards the injected data-source resolver to the live preview", async () => {
    const resolve = vi.fn().mockResolvedValue([{ label: "上海", value: "sh" }]);
    const remoteSchema: FormSchema = {
      id: "Form_R",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "F",
              type: "select",
              key: "city",
              label: "城市",
              dataSource: { kind: "remote", request: { resource: "city", action: "list" } }
            }
          ]
        }
      }
    };

    setupView(remoteSchema, { dataSourceResolver: { resolve } });

    // The remote select can only resolve options if the runtime reached the
    // preview's FormRenderer — the seam this guards.
    await waitFor(() => expect(resolve).toHaveBeenCalled());
  });

  describe("editable buffer", () => {
    it("keeps the apply controls hidden while the buffer is pristine", () => {
      setupView();

      expect(screen.queryByRole("button", { name: "应用" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "还原" })).not.toBeInTheDocument();
    });

    it("applies an edited buffer to the store", async () => {
      const user = userEvent.setup();
      const storeApi = setupView();
      const next = { ...makeSchema(), id: "Form_renamed" };

      await replaceBuffer(user, JSON.stringify(next, null, 2));
      await user.click(screen.getByRole("button", { name: "应用" }));

      expect(storeApi.getState().schema.id).toBe("Form_renamed");
      // The buffer snaps to the canonical pretty print — no longer dirty.
      expect(screen.queryByRole("button", { name: "应用" })).not.toBeInTheDocument();
    });

    it("reports structured errors without touching the store", async () => {
      const user = userEvent.setup();
      const storeApi = setupView();
      const before = storeApi.getState().schema;

      await replaceBuffer(user, JSON.stringify({ version: 2 }));
      await user.click(screen.getByRole("button", { name: "应用" }));

      expect(screen.getByRole("alert")).toHaveTextContent("id");
      expect(storeApi.getState().schema).toBe(before);
    });

    it("restores the committed schema on 还原", async () => {
      const user = userEvent.setup();
      setupView();

      await replaceBuffer(user, "{}");
      await user.click(screen.getByRole("button", { name: "还原" }));

      expect(screen.queryByRole("button", { name: "应用" })).not.toBeInTheDocument();
      expect(screen.getByLabelText("schema-json")).toHaveValue(JSON.stringify(makeSchema(), null, 2));
    });
  });
});
