import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FieldLinkage, FormSchema } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { FormLinkagePanel } from "./form-linkage-panel";

function makeSchema(linkage?: FieldLinkage): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    ...linkage && { linkage },
    presentations: {
      pc: {
        children: [
          {
            id: "Field_amount",
            type: "number",
            key: "amount",
            label: "金额"
          }
        ]
      }
    }
  };
}

interface HarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

/**
 * Mirrors the form-config drawer wiring: the form-scope linkage comes from the
 * store schema and commits patch it back.
 */
function Harness({ onReady }: HarnessProps): ReactElement {
  const api = useFormEditorStoreApi();
  const schema = useFormEditorStore(state => state.schema);

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return <FormLinkagePanel schema={schema} onChange={linkage => api.getState().patchSchema({ linkage })} />;
}

function setup(linkage?: FieldLinkage): FormEditorStoreApi {
  let captured: FormEditorStoreApi | null = null;

  render(
    <FormEditorStoreProvider initialState={{ schema: makeSchema(linkage) }}>
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

describe("FormLinkagePanel", () => {
  it("offers only effect actions in the palette", async () => {
    const user = userEvent.setup();
    setup({
      rules: [
        {
          id: "R1",
          trigger: { kind: "load" },
          actions: [
            {
              id: "A1",
              type: "alert",
              message: { kind: "literal", value: "hi" }
            }
          ]
        }
      ]
    });

    // Combobox order on the card: trigger kind, then the action's type select.
    const [, actionTypeSelect] = screen.getAllByRole("combobox");
    await user.click(actionTypeSelect as HTMLElement);
    await screen.findByText("设置字段");

    // The form has no self field whose state could be derived — no state
    // actions in the dropdown.
    expect(screen.queryByText("显示")).not.toBeInTheDocument();
    expect(screen.queryByText("赋值")).not.toBeInTheDocument();
  });

  it("adds a rule through the form-scope seed", async () => {
    const user = userEvent.setup();
    const api = setup();

    await user.click(screen.getByRole("button", { name: /新建事件规则/ }));

    const rules = api.getState().schema.linkage?.rules;
    expect(rules).toHaveLength(1);
    // A root keyed field exists, so the seed is a form-wide condition rule.
    expect(rules?.[0]?.trigger.kind).toBe("condition");
  });

  it("shows a rule's validator warning on its card", () => {
    setup({
      rules: [
        {
          id: "R1",
          trigger: { kind: "load" },
          actions: [
            {
              id: "A1",
              type: "set_variable",
              variable: "",
              value: { kind: "literal", value: "1" }
            }
          ]
        }
      ]
    });

    expect(screen.getByText("variable 尚未填写")).toBeInTheDocument();
  });
});
