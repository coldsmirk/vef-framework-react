import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FieldLinkage, FormSchema, FormVariable } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { FormVariablesPanel } from "./form-variables-panel";

function makeSchema(variables: FormVariable[], linkage?: FieldLinkage): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    ...variables.length > 0 ? { variables } : {},
    ...linkage ? { linkage } : {},
    presentations: { pc: { children: [] } }
  };
}

interface HarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

/**
 * Mirrors the form-config drawer wiring: variables come from the store schema
 * and updates patch them back, so the panel's store-backed rename/remove and
 * its onChange path stay in sync.
 */
function Harness({ onReady }: HarnessProps): ReactElement {
  const api = useFormEditorStoreApi();
  const variables = useFormEditorStore(state => state.schema.variables);

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return (
    <FormVariablesPanel
      variables={variables ?? []}
      onChange={next => api.getState().patchSchema({ variables: next.length > 0 ? next : undefined })}
    />
  );
}

function setup(variables: FormVariable[] = [], linkage?: FieldLinkage): FormEditorStoreApi {
  let captured: FormEditorStoreApi | null = null;

  render(
    <FormEditorStoreProvider initialState={{ schema: makeSchema(variables, linkage) }}>
      <Harness
        onReady={api => {
          captured = api;
        }}
      />
    </FormEditorStoreProvider>
  );

  if (!captured) {
    throw new Error("Form store API was not captured");
  }

  return captured;
}

function storeVariables(api: FormEditorStoreApi): FormVariable[] {
  return api.getState().schema.variables ?? [];
}

describe("form variables panel", () => {
  it("adds a string variable", async () => {
    const user = userEvent.setup();
    const api = setup();

    await user.click(screen.getByRole("button", { name: /新增变量/ }));

    const variables = storeVariables(api);
    expect(variables).toHaveLength(1);
    expect(variables[0]).toMatchObject({ name: "", type: "string" });
  });

  describe("default value editing", () => {
    it("commits a decimal number entered digit by digit", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "rate",
          type: "number"
        }
      ]);

      const input = screen.getByPlaceholderText("默认值");
      await user.click(input);
      await user.keyboard("3.14");

      // The draft keeps the literal text while typing — `3.` is never
      // round-tripped through Number() mid-edit (which swallowed the dot and
      // turned 3.14 into 314).
      expect(input).toHaveValue("3.14");

      await user.tab();

      expect(storeVariables(api)[0]?.defaultValue).toBe(3.14);
    });

    it("commits valid JSON on blur without re-stringifying under the cursor", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "config",
          type: "json"
        }
      ]);

      const input = screen.getByPlaceholderText("默认值");
      await user.click(input);
      await user.keyboard("{{\"a\": 1}");

      expect(input).toHaveValue("{\"a\": 1}");

      await user.tab();

      expect(storeVariables(api)[0]?.defaultValue).toEqual({ a: 1 });
    });

    it("edits a boolean default through the segmented control", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "flag",
          type: "boolean",
          defaultValue: false
        }
      ]);

      await user.click(screen.getByText("是"));

      expect(storeVariables(api)[0]?.defaultValue).toBe(true);
    });

    it("seeds a concrete false when switching a variable to boolean", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "flag",
          type: "string"
        }
      ]);

      await user.click(screen.getByRole("combobox"));
      await user.click(await screen.findByText("布尔"));

      // The Segmented shows "否" for false; the stored value must be `false`,
      // not `undefined`, so `$vars.flag === false` / `empty` agree with the UI.
      expect(storeVariables(api)[0]).toMatchObject({ type: "boolean", defaultValue: false });
    });
  });

  describe("naming", () => {
    it("sanitizes the committed name", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "tax",
          type: "string"
        }
      ]);

      const input = screen.getByDisplayValue("tax");
      await user.click(input);
      await user.keyboard(" rate");
      await user.tab();

      // Spaces are stripped on commit (names must be `$vars.<identifier>`-safe).
      expect(storeVariables(api)[0]?.name).toBe("taxrate");
    });

    it("uniquifies a committed duplicate name instead of shadowing its twin", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "tax",
          type: "string"
        },
        {
          id: "v2",
          name: "rate",
          type: "string"
        }
      ]);

      const input = screen.getByDisplayValue("rate");
      await user.click(input);
      await user.clear(input);
      await user.keyboard("tax");
      await user.tab();

      expect(storeVariables(api).map(variable => variable.name)).toEqual(["tax", "tax_2"]);
    });

    it("dispatches renameVariable so set_variable references follow", async () => {
      const user = userEvent.setup();
      const linkage: FieldLinkage = {
        rules: [
          {
            id: "R1",
            trigger: { kind: "load" },
            actions: [
              {
                id: "A1",
                type: "set_variable",
                variable: "total",
                value: { kind: "literal", value: "0" }
              }
            ]
          }
        ]
      };
      const api = setup([
        {
          id: "v1",
          name: "total",
          type: "number"
        }
      ], linkage);
      const renameSpy = vi.spyOn(api.getState(), "renameVariable");

      const input = screen.getByDisplayValue("total");
      await user.click(input);
      await user.clear(input);
      await user.keyboard("sum");
      await user.tab();

      expect(renameSpy).toHaveBeenCalledWith("total", "sum");
      expect(storeVariables(api)[0]?.name).toBe("sum");
      // The reference rewrite is the store's job — asserting it here pins the
      // panel to the reference-following action, not a bare list patch.
      const action = api.getState().schema.linkage?.rules?.[0]?.actions?.[0];
      expect(action).toMatchObject({ type: "set_variable", variable: "sum" });
    });

    it("keeps the current name when the committed input sanitizes to empty", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "tax",
          type: "string"
        }
      ]);

      const input = screen.getByDisplayValue("tax");
      await user.click(input);
      await user.clear(input);
      await user.tab();

      expect(storeVariables(api)[0]?.name).toBe("tax");
    });
  });

  describe("removal", () => {
    it("dispatches removeVariable for a named variable", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "total",
          type: "string"
        }
      ]);
      const removeSpy = vi.spyOn(api.getState(), "removeVariable");

      await user.click(screen.getByRole("button", { name: "删除变量" }));

      expect(removeSpy).toHaveBeenCalledWith("total");
      expect(storeVariables(api)).toEqual([]);
    });

    it("removes an unnamed variable through the plain list patch", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "",
          type: "string"
        }
      ]);

      await user.click(screen.getByRole("button", { name: "删除变量" }));

      expect(storeVariables(api)).toEqual([]);
    });
  });
});
