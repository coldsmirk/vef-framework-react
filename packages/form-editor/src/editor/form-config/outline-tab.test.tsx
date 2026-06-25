import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { OutlineTab } from "./outline-tab";

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
          },
          {
            id: "Section_1",
            type: "section",
            variant: "card",
            title: "信息分组",
            children: [
              {
                id: "Field_2",
                type: "textfield",
                key: "phone",
                label: "电话"
              }
            ]
          }
        ]
      }
    }
  };
}

function containerSchema(type: "flex" | "grid"): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Container_1",
            type,
            children: [
              {
                id: "Field_1",
                type: "textfield",
                key: "nested",
                label: "嵌套字段"
              }
            ]
          }
        ]
      }
    }
  };
}

function renderOutline(schema: FormSchema): void {
  render(
    <FormEditorStoreProvider initialState={{ schema }}>
      <RegistryProvider registries={{ pc: createDefaultRegistry(), mobile: createDefaultRegistry() }}>
        <OutlineTab />
      </RegistryProvider>
    </FormEditorStoreProvider>
  );
}

function setupOutline(): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;

  function Harness(): ReactElement {
    const api = useFormEditorStoreApi();

    useEffect(() => {
      storeApi = api;
    }, [api]);

    return <OutlineTab />;
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

describe("OutlineTab", () => {
  it("shows an empty-state placeholder when the form has no fields", () => {
    renderOutline({
      id: "Form_1",
      version: 2,
      presentations: { pc: { children: [] } }
    });

    expect(screen.getByText("还没有任何字段")).toBeInTheDocument();
  });

  it("lists a container and its nested child field", () => {
    setupOutline();

    expect(screen.getByText("信息分组")).toBeInTheDocument();
    expect(screen.getByText("电话")).toBeInTheDocument();
  });

  it("lists a field nested inside a grid container", () => {
    renderOutline(containerSchema("grid"));

    expect(screen.getByText("嵌套字段")).toBeInTheDocument();
  });

  it("lists a field nested inside a flex container", () => {
    renderOutline(containerSchema("flex"));

    expect(screen.getByText("嵌套字段")).toBeInTheDocument();
  });

  it("selects a leaf field when clicked", async () => {
    const user = userEvent.setup();
    const storeApi = setupOutline();

    await user.click(screen.getByText("姓名"));

    expect(storeApi.getState().selectedId).toBe("Field_1");
  });

  it("selects a container when clicked", async () => {
    const user = userEvent.setup();
    const storeApi = setupOutline();

    await user.click(screen.getByText("信息分组"));

    expect(storeApi.getState().selectedId).toBe("Section_1");
  });
});
