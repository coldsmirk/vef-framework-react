import type { ReactNode } from "react";

import type { Block, FormSchema, TextfieldField } from "../types";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";

function field(key: string, overrides: Partial<TextfieldField> = {}): TextfieldField {
  return {
    id: `Field_${key}`,
    type: "textfield",
    key,
    label: key,
    ...overrides
  };
}

function stack(...blocks: Block[]): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children: blocks } }
  };
}

function renderStrict(ui: ReactNode): void {
  const registry = createDefaultRegistry();

  render(
    <StrictMode>
      <RegistryProvider registries={{ pc: registry, mobile: registry }}>{ui}</RegistryProvider>
    </StrictMode>
  );
}

describe("FormRenderer under StrictMode", () => {
  it("does not fire a condition effect already true on mount", () => {
    const notify = vi.fn();
    const schema = stack(
      field("watcher", {
        linkage: {
          rules: [
            {
              id: "R1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "watcher",
                  operator: "empty"
                }
              },
              actions: [{ type: "alert", message: { kind: "literal", value: "hi" } }]
            }
          ]
        }
      })
    );

    renderStrict(<FormRenderer schema={schema} services={{ notify }} />);

    expect(notify).not.toHaveBeenCalled();
  });

  it("does not fire an always-retriggered expression rule on mount", () => {
    const notify = vi.fn();
    const schema = stack(
      field("watcher", {
        linkage: {
          rules: [
            {
              id: "R1",
              trigger: {
                kind: "condition",
                retrigger: "always",
                condition: { kind: "expression", source: "true" }
              },
              actions: [
                {
                  type: "alert",
                  message: { kind: "literal", value: "hi" }
                }
              ]
            }
          ]
        }
      })
    );

    renderStrict(<FormRenderer schema={schema} services={{ notify }} />);

    expect(notify).not.toHaveBeenCalled();
  });

  it("fires the load lifecycle effect exactly once", async () => {
    const notify = vi.fn();
    const schema: FormSchema = {
      ...stack(field("name")),
      linkage: {
        rules: [
          {
            id: "F1",
            trigger: { kind: "load" },
            actions: [{ type: "alert", message: { kind: "literal", value: "loaded" } }]
          }
        ]
      }
    };

    renderStrict(<FormRenderer schema={schema} services={{ notify }} />);

    await waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps typed values controlled", async () => {
    const user = userEvent.setup();

    renderStrict(<FormRenderer schema={stack(field("name"))} />);

    const input = screen.getByRole("textbox", { name: "name" });
    await user.type(input, "hello");

    expect(input).toHaveValue("hello");
  });

  it("fires an edge effect exactly once per rising transition", async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    const schema = stack(
      field("trigger"),
      field("watcher", {
        linkage: {
          rules: [
            {
              id: "R1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "trigger",
                  operator: "notEmpty"
                }
              },
              actions: [{ type: "alert", message: { kind: "literal", value: "hi" } }]
            }
          ]
        }
      })
    );

    renderStrict(<FormRenderer schema={schema} services={{ notify }} />);

    await user.type(screen.getByRole("textbox", { name: "trigger" }), "ab");

    expect(notify).toHaveBeenCalledTimes(1);
  });
});
