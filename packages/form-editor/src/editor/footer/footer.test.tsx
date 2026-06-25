import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema } from "../../types";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { EditorFooter } from "./footer";

function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    variables: [
      {
        id: "Var_1",
        name: "flag",
        type: "boolean"
      }
    ],
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

function setupFooter(schema: FormSchema = makeSchema()): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;

  function Harness(): ReactElement {
    const api = useFormEditorStoreApi();

    useEffect(() => {
      storeApi = api;
    }, [api]);

    return <EditorFooter />;
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

/**
 * One field-level rule (on 姓名, watching a key that exists) plus one
 * form-level event rule — the 联动 pill must aggregate both.
 */
function linkageSchema(): FormSchema {
  const schema = makeSchema();

  schema.presentations.pc.children.push({
    id: "Field_2",
    type: "textfield",
    key: "age",
    label: "年龄",
    linkage: {
      rules: [
        {
          id: "Rule_field",
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
                  sourceKey: "name",
                  operator: "eq",
                  value: "1"
                }
              ]
            }
          },
          actions: [{ id: "Action_show", type: "show" }]
        }
      ]
    }
  });
  schema.linkage = {
    rules: [
      {
        id: "Rule_form",
        trigger: { kind: "load" },
        actions: [
          {
            id: "Action_alert",
            type: "alert",
            level: "info",
            message: { kind: "literal", value: "hi" }
          }
        ]
      }
    ]
  };

  return schema;
}

describe("EditorFooter", () => {
  it("shows the field and variable counts", () => {
    setupFooter();

    expect(within(screen.getByRole("button", { name: /字段/ })).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /变量/ })).getByText("1")).toBeInTheDocument();
  });

  it("aggregates field-level and form-level rules into the 联动 count", () => {
    setupFooter(linkageSchema());

    expect(within(screen.getByRole("button", { name: /联动/ })).getByText("2")).toBeInTheDocument();
  });

  it("renders no issues chip for a clean schema", () => {
    setupFooter();

    expect(screen.queryByTestId("footer-issues")).not.toBeInTheDocument();
  });

  it("surfaces schema warnings as an issues chip", () => {
    const schema = makeSchema();

    // A default-hidden field with no show rule is the canonical warning.
    schema.presentations.pc.children.push({
      id: "Field_hidden",
      type: "textfield",
      key: "ghost",
      label: "幽灵",
      linkage: { defaults: { hidden: true }, rules: [] }
    });

    setupFooter(schema);

    expect(screen.getByTestId("footer-issues")).toHaveTextContent("1 项提示");
  });

  it("opens the drawer to a tab when a count pill is clicked", async () => {
    const user = userEvent.setup();
    const storeApi = setupFooter();

    await user.click(screen.getByRole("button", { name: /变量/ }));

    expect(storeApi.getState().formConfigOpen).toBe(true);
    expect(storeApi.getState().formConfigTab).toBe("variables");
  });

  it("toggles the drawer with the form-config switch", async () => {
    const user = userEvent.setup();
    const storeApi = setupFooter();

    await user.click(screen.getByRole("button", { name: /表单配置/ }));
    expect(storeApi.getState().formConfigOpen).toBe(true);

    await user.click(screen.getByRole("button", { name: /表单配置/ }));
    expect(storeApi.getState().formConfigOpen).toBe(false);
  });
});
