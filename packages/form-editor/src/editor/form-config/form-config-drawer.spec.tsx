import type { ReactElement } from "react";

import type { FormConfigTabId, FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { FormConfigDrawer } from "./form-config-drawer";

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

function setupDrawer(tab?: FormConfigTabId): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;

  function Harness(): ReactElement {
    const api = useFormEditorStoreApi();

    useEffect(() => {
      if (tab) {
        api.getState().setFormConfigTab(tab);
      }

      storeApi = api;
    }, [api]);

    return <FormConfigDrawer />;
  }

  render(
    <FormEditorStoreProvider initialState={{ schema: makeSchema() }}>
      <RegistryProvider registries={{ pc: createDefaultRegistry(), mobile: createDefaultRegistry() }}>
        <Harness />
      </RegistryProvider>
    </FormEditorStoreProvider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return storeApi;
}

describe("FormConfigDrawer", () => {
  it("renders nothing while collapsed", () => {
    setupDrawer();

    expect(screen.queryByRole("button", { name: "收起表单配置" })).not.toBeInTheDocument();
  });

  it("renders the form-basics tab", async () => {
    setupDrawer("form");

    expect(await screen.findByLabelText("表单 ID")).toBeInTheDocument();
  });

  it("renders the schema outline tab", async () => {
    setupDrawer("outline");

    // The outline lists the canvas field by its label.
    expect(await screen.findByText("姓名")).toBeInTheDocument();
  });

  it("writes a new variable through patchSchema from the variables tab", async () => {
    const user = userEvent.setup();
    const storeApi = setupDrawer("variables");

    await user.click(await screen.findByRole("button", { name: /新增变量/ }));

    expect(storeApi.getState().schema.variables).toHaveLength(1);
  });

  it("collapses when the header close button is clicked", async () => {
    const user = userEvent.setup();
    const storeApi = setupDrawer("form");

    await user.click(await screen.findByRole("button", { name: "收起表单配置" }));

    expect(storeApi.getState().formConfigOpen).toBe(false);
  });
});
