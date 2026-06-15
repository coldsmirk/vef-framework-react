import type { ReactNode } from "react";

import type { Block, FormSchema, TextfieldField } from "../types";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";

/**
 * StrictMode smoke coverage. The runtime leans on render-phase ref writes
 * (`stabilizeStateMap`'s prev map, the effect lane's edge trackers, the subform
 * row-key list) and on effects that React 19 StrictMode double-invokes — these
 * specs pin that a double-invoked mount neither fires condition effects nor
 * duplicates lifecycle effects, and that the form still behaves.
 */

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
    const dispatchEffect = vi.fn();
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

    renderStrict(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

    expect(dispatchEffect).not.toHaveBeenCalled();
  });

  it("does not fire an always-retriggered expression rule on mount", () => {
    // The opaque (expression) condition has no tracked source keys; the
    // StrictMode double-invoked detection effect must read the unchanged
    // `values` reference as "no value change" — before the value-diff fix the
    // second run treated the null signature as always-changed and fired.
    const dispatchEffect = vi.fn();
    const schema = stack(
      field("watcher", {
        linkage: {
          rules: [
            {
              id: "R1",
              trigger: { kind: "condition", condition: { kind: "expression", source: "true" } },
              actions: [
                {
                  type: "alert",
                  retrigger: "always",
                  message: { kind: "literal", value: "hi" }
                }
              ]
            }
          ]
        }
      })
    );

    renderStrict(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

    expect(dispatchEffect).not.toHaveBeenCalled();
  });

  it("fires the load lifecycle effect exactly once", async () => {
    const dispatchEffect = vi.fn();
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

    renderStrict(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

    await waitFor(() => {
      expect(dispatchEffect).toHaveBeenCalledTimes(1);
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
    const dispatchEffect = vi.fn();
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

    renderStrict(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

    // "a" raises the edge once; "b" keeps the condition true with no new edge.
    await user.type(screen.getByRole("textbox", { name: "trigger" }), "ab");

    expect(dispatchEffect).toHaveBeenCalledTimes(1);
  });
});
