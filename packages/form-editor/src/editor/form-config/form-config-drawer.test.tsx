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

function setupDrawer(tab?: FormConfigTabId, schema: FormSchema = makeSchema()): FormEditorStoreApi {
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
    <FormEditorStoreProvider initialState={{ schema }}>
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

  it("indexes field-level linkage rules on the linkage tab", async () => {
    setupDrawer("linkage", makeLinkageSchema());

    // The bearer field is listed with its rule count; the form-level event
    // editor renders beneath as its own section.
    expect(await screen.findByText("备注")).toBeInTheDocument();
    expect(screen.getByText(/1\s*条规则/)).toBeInTheDocument();
    expect(screen.getByText("还没有事件规则")).toBeInTheDocument();
  });

  it("selects the bearer field when its overview row is clicked", async () => {
    const user = userEvent.setup();
    const storeApi = setupDrawer("linkage", makeLinkageSchema());

    await user.click(await screen.findByText("备注"));

    expect(storeApi.getState().selectedId).toBe("Field_2");
  });

  it("counts field rules plus form events in the linkage tab badge", async () => {
    const schema = makeLinkageSchema();
    schema.linkage = {
      rules: [
        {
          id: "Form_rule_1",
          trigger: { kind: "load" },
          actions: [
            {
              id: "Action_form_1",
              type: "set_field",
              targetKey: "name",
              value: { kind: "literal", value: "seed" }
            }
          ]
        }
      ]
    };
    setupDrawer("linkage", schema);

    // 1 field rule + 1 form event — the same aggregate the footer chip shows.
    const tabs = await screen.findAllByRole("tab");
    const linkageTab = tabs.find(tab => tab.textContent?.includes("联动"));
    expect(linkageTab).toHaveTextContent(/^联动2$/);
  });

  it("collapses when the header close button is clicked", async () => {
    const user = userEvent.setup();
    const storeApi = setupDrawer("form");

    await user.click(await screen.findByRole("button", { name: "收起表单配置" }));

    expect(storeApi.getState().formConfigOpen).toBe(false);
  });
});
