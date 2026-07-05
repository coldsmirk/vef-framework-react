import type { ReactNode } from "react";

import type { Block, ButtonField, DataSourceResolver, FormSchema, SelectField, SubformNode, TextfieldField } from "../types";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { FormRenderer } from "../render/form-renderer";
import { RegistryProvider } from "../store/engine-provider";

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
    presentations: {
      pc: {
        children: blocks
      }
    }
  };
}

function renderForm(ui: ReactNode): ReturnType<typeof render> {
  const registry = createDefaultRegistry();

  return render(<RegistryProvider registries={{ pc: registry, mobile: registry }}>{ui}</RegistryProvider>);
}

/**
 * A form whose single field is hidden by default and shown only when the
 * `$vars.unlocked` variable is true — the variable's value comes from the
 * schema default, so this exercises the runtime sourcing `$vars`.
 */
function gatedSchema(unlocked: boolean): FormSchema {
  return {
    ...stack(
      field("code", {
        linkage: {
          defaults: { hidden: true },
          rules: [
            {
              id: "R1",
              trigger: { kind: "condition", condition: { kind: "expression", source: "$vars.unlocked === true" } },
              actions: [{ type: "show" }]
            }
          ]
        }
      })
    ),
    variables: [
      {
        id: "v1",
        name: "unlocked",
        type: "boolean",
        defaultValue: unlocked
      }
    ]
  };
}

/**
 * A form where typing in `trigger` fires a `change` → `set_variable` count = "1",
 * and `watcher` (hidden by default) shows once `$vars.count === "1"`.
 */
function countingSchema(): FormSchema {
  return {
    ...stack(
      field("trigger", {
        linkage: {
          rules: [
            {
              id: "R1",
              trigger: { kind: "change" },
              actions: [
                {
                  type: "set_variable",
                  variable: "count",
                  value: { kind: "literal", value: "1" }
                }
              ]
            }
          ]
        }
      }),
      field("watcher", {
        linkage: {
          defaults: { hidden: true },
          rules: [
            {
              id: "R2",
              trigger: { kind: "condition", condition: { kind: "expression", source: "$vars.count === '1'" } },
              actions: [{ type: "show" }]
            }
          ]
        }
      })
    ),
    variables: [
      {
        id: "v1",
        name: "count",
        type: "string",
        defaultValue: "0"
      }
    ]
  };
}

/**
 * A form whose `picker` select is bound (by `ref`) to a remote data source, and
 * whose `trigger` field fires a `change` → `refresh_data_source`. Used to prove
 * the effect re-resolves the source through the host resolver.
 */
function refreshDataSourceSchema(): FormSchema {
  const picker: SelectField = {
    id: "Field_picker",
    type: "select",
    key: "picker",
    label: "picker",
    dataSource: { kind: "ref", dataSourceId: "ds1" }
  };

  return {
    ...stack(
      picker,
      field("trigger", {
        linkage: {
          rules: [
            {
              id: "R1",
              trigger: { kind: "change" },
              actions: [{ type: "refresh_data_source", dataSourceId: "ds1" }]
            }
          ]
        }
      })
    ),
    dataSources: [
      {
        id: "ds1",
        name: "城市",
        kind: "remote",
        request: { resource: "geo", action: "cities" }
      }
    ]
  };
}

describe("runtime effect lane", () => {
  describe("condition rising edge", () => {
    it("fires a condition effect once on the rising edge, not per keystroke", async () => {
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

      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

      // "a" → notEmpty becomes true (rising edge → fire); "ab" stays true (no edge).
      await user.type(screen.getByRole("textbox", { name: "trigger" }), "ab");

      expect(dispatchEffect).toHaveBeenCalledTimes(1);
    });

    it("re-fires after the condition falls and rises again", async () => {
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
                    operator: "eq",
                    value: "go"
                  }
                },
                actions: [{ type: "alert", message: { kind: "literal", value: "hi" } }]
              }
            ]
          }
        })
      );

      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

      const input = screen.getByRole("textbox", { name: "trigger" });
      await user.type(input, "go");
      // "gox" — condition falls
      await user.type(input, "x");
      // back to "go" — rises again
      await user.type(input, "{Backspace}");

      expect(dispatchEffect).toHaveBeenCalledTimes(2);
    });

    it("does not fire a condition effect already true on mount", () => {
      const dispatchEffect = vi.fn();
      const schema = stack(
        field("watcher", {
          linkage: {
            rules: [
              {
                // Self-referencing effect rule: "when my value is empty → alert".
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

      // `watcher` is empty on mount → condition true, but a seed is not a rising
      // edge, so nothing fires.
      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

      expect(dispatchEffect).not.toHaveBeenCalled();
    });
  });

  describe("condition retrigger 'always'", () => {
    it("re-fires on every source-field change while the condition holds", async () => {
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

      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

      // "a" makes it true; "b" and "c" keep it true but each changes the source,
      // so an `always` rule fires on all three keystrokes (an `edge` rule fires once).
      await user.type(screen.getByRole("textbox", { name: "trigger" }), "abc");

      expect(dispatchEffect).toHaveBeenCalledTimes(3);
    });

    it("does not re-fire when an unrelated field changes", async () => {
      const user = userEvent.setup();
      const dispatchEffect = vi.fn();
      const schema = stack(
        field("trigger"),
        field("other"),
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

      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

      await user.type(screen.getByRole("textbox", { name: "trigger" }), "x");
      expect(dispatchEffect).toHaveBeenCalledTimes(1);

      // `other` is not a source of the condition, so typing into it must not
      // re-fire the rule even though the condition still holds.
      await user.type(screen.getByRole("textbox", { name: "other" }), "yz");

      expect(dispatchEffect).toHaveBeenCalledTimes(1);
    });

    it("converges when an always expression rule writes a variable", async () => {
      const user = userEvent.setup();
      const dispatchEffect = vi.fn();
      // The loop combo (all UI-authorable): an opaque expression condition has
      // no tracked source keys, `always` re-fires it, and `set_variable`
      // re-runs the detector through the evaluation context. It must re-fire
      // once per actual VALUE change — a context-only re-run (its own write)
      // or an identical-value write must not cascade.
      const schema = stack(
        field("trigger"),
        field("watcher", {
          linkage: {
            rules: [
              {
                id: "R1",
                trigger: { kind: "condition", condition: { kind: "expression", source: "$form.trigger != ''" } },
                actions: [
                  {
                    type: "set_variable",
                    retrigger: "always",
                    variable: "count",
                    value: { kind: "literal", value: "1" }
                  },
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

      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

      // "x" raises the edge: both actions fire once; the variable write must
      // not re-trigger the rule (no value changed).
      await user.type(screen.getByRole("textbox", { name: "trigger" }), "x");
      expect(dispatchEffect).toHaveBeenCalledTimes(1);

      // "y" is one more value change while the condition holds → exactly one
      // re-fire (the set_variable repeat writes the identical value and bails).
      await user.type(screen.getByRole("textbox", { name: "trigger" }), "y");
      expect(dispatchEffect).toHaveBeenCalledTimes(2);
    });

    it("does not loop when an always expression rule rewrites the same field value", async () => {
      const user = userEvent.setup();
      const dispatchEffect = vi.fn();
      const schema = stack(
        field("trigger"),
        field("target"),
        field("watcher", {
          linkage: {
            rules: [
              {
                id: "R1",
                trigger: { kind: "condition", condition: { kind: "expression", source: "$form.trigger != ''" } },
                actions: [
                  {
                    type: "set_field",
                    retrigger: "always",
                    targetKey: "target",
                    value: { kind: "literal", value: "filled" }
                  },
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

      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

      await user.type(screen.getByRole("textbox", { name: "trigger" }), "x");

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "target" })).toHaveValue("filled");
      });
      // Rising edge fires once; the set_field write is itself one real value
      // change, so the always lane legitimately repeats once more — and the
      // repeated set_field writes the value the target already holds, which is
      // dropped, so the cascade stops at exactly two dispatches.
      expect(dispatchEffect).toHaveBeenCalledTimes(2);
    });

    it("does not fire on mount even when retrigger is 'always'", () => {
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

      // `watcher` is empty on mount → condition true, but the seed run never
      // fires, the same as an `edge` rule.
      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

      expect(dispatchEffect).not.toHaveBeenCalled();
    });
  });

  describe("field events", () => {
    it("fires a change-triggered effect through the host dispatcher", async () => {
      const user = userEvent.setup();
      const dispatchEffect = vi.fn();
      const schema = stack(
        field("a", {
          linkage: {
            rules: [
              {
                id: "R1",
                trigger: { kind: "change" },
                actions: [{ type: "alert", message: { kind: "literal", value: "x" } }]
              }
            ]
          }
        })
      );

      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

      await user.type(screen.getByRole("textbox", { name: "a" }), "z");

      expect(dispatchEffect).toHaveBeenCalledWith(
        expect.objectContaining({ type: "alert" }),
        expect.anything()
      );
    });

    it("fires a blur-triggered effect when focus leaves the field", async () => {
      const user = userEvent.setup();
      const dispatchEffect = vi.fn();
      const schema = stack(
        field("a", {
          linkage: {
            rules: [
              {
                id: "R1",
                trigger: { kind: "blur" },
                actions: [{ type: "alert", message: { kind: "literal", value: "bye" } }]
              }
            ]
          }
        }),
        field("b")
      );

      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

      await user.click(screen.getByRole("textbox", { name: "a" }));
      await user.click(screen.getByRole("textbox", { name: "b" }));

      expect(dispatchEffect).toHaveBeenCalledWith(
        expect.objectContaining({ type: "alert" }),
        expect.anything()
      );
    });
  });

  describe("native effects", () => {
    it("writes another field via a set_field effect", async () => {
      const user = userEvent.setup();
      const schema = stack(
        field("source", {
          linkage: {
            rules: [
              {
                id: "R1",
                trigger: { kind: "change" },
                actions: [
                  {
                    type: "set_field",
                    targetKey: "target",
                    value: { kind: "literal", value: "filled" }
                  }
                ]
              }
            ]
          }
        }),
        field("target")
      );

      renderForm(<FormRenderer schema={schema} />);

      await user.type(screen.getByRole("textbox", { name: "source" }), "x");

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "target" })).toHaveValue("filled");
      });
    });

    it("submits the form from a click-triggered submit effect", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const button: ButtonField = {
        id: "Field_go",
        type: "button",
        label: "执行",
        action: "button",
        linkage: {
          rules: [
            {
              id: "R1",
              trigger: { kind: "click" },
              actions: [{ type: "submit" }]
            }
          ]
        }
      };
      const schema = stack(field("name"), button);

      renderForm(<FormRenderer schema={schema} onSubmit={onSubmit} />);

      await user.click(screen.getByRole("button", { name: "执行" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("form lifecycle", () => {
    it("fires a form-scope load effect on mount", async () => {
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

      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} />);

      await waitFor(() => {
        expect(dispatchEffect).toHaveBeenCalledWith(
          expect.objectContaining({ type: "alert" }),
          expect.anything()
        );
      });
    });

    it("fires beforeSubmit and afterSubmit around a submission", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const dispatchEffect = vi.fn();
      const button: ButtonField = {
        id: "Field_go",
        type: "button",
        label: "提交",
        action: "button",
        linkage: {
          rules: [
            {
              id: "B",
              trigger: { kind: "click" },
              actions: [{ type: "submit" }]
            }
          ]
        }
      };
      const schema: FormSchema = {
        ...stack(field("name"), button),
        linkage: {
          rules: [
            {
              id: "F1",
              trigger: { kind: "beforeSubmit" },
              actions: [{ type: "alert", message: { kind: "literal", value: "before" } }]
            },
            {
              id: "F2",
              trigger: { kind: "afterSubmit" },
              actions: [{ type: "alert", message: { kind: "literal", value: "after" } }]
            }
          ]
        }
      };

      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} onSubmit={onSubmit} />);

      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
      expect(dispatchEffect).toHaveBeenCalledWith(
        expect.objectContaining({ message: { kind: "literal", value: "before" } }),
        expect.anything()
      );
      expect(dispatchEffect).toHaveBeenCalledWith(
        expect.objectContaining({ message: { kind: "literal", value: "after" } }),
        expect.anything()
      );
    });

    it("awaits an async beforeSubmit effect before running the host onSubmit", async () => {
      const user = userEvent.setup();
      const order: string[] = [];
      // A host `dispatchEffect` that resolves on a later microtask; if the
      // lifecycle did not await it, `onSubmit` would record first.
      const dispatchEffect = vi.fn(async () => {
        await Promise.resolve();
        order.push("before");
      });
      const onSubmit = vi.fn(() => {
        order.push("submit");
      });
      const button: ButtonField = {
        id: "Field_go",
        type: "button",
        label: "提交",
        action: "button",
        linkage: {
          rules: [
            {
              id: "B",
              trigger: { kind: "click" },
              actions: [{ type: "submit" }]
            }
          ]
        }
      };
      const schema: FormSchema = {
        ...stack(field("name"), button),
        linkage: {
          rules: [
            {
              id: "F1",
              trigger: { kind: "beforeSubmit" },
              actions: [{ type: "alert", message: { kind: "literal", value: "before" } }]
            }
          ]
        }
      };

      renderForm(<FormRenderer evaluators={{ dispatchEffect }} schema={schema} onSubmit={onSubmit} />);

      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
      expect(order).toEqual(["before", "submit"]);
    });
  });

  describe("evaluation scope", () => {
    it("sources $vars from schema variables so linkage reads them at runtime", () => {
      renderForm(<FormRenderer schema={gatedSchema(true)} />);

      // `$vars.unlocked` is true (its schema default) → the gated field shows.
      expect(screen.getByRole("textbox", { name: "code" })).toBeInTheDocument();
    });

    it("keeps the field hidden when the $vars condition is false", () => {
      renderForm(<FormRenderer schema={gatedSchema(false)} />);

      expect(screen.queryByRole("textbox", { name: "code" })).not.toBeInTheDocument();
    });
  });

  describe("set_variable", () => {
    it("mutates $vars and re-evaluates linkage that reads it", async () => {
      const user = userEvent.setup();

      renderForm(<FormRenderer schema={countingSchema()} />);

      // `count` starts at "0" → watcher hidden.
      expect(screen.queryByRole("textbox", { name: "watcher" })).not.toBeInTheDocument();

      // Typing fires the change effect → set_variable count = "1" → watcher shows.
      await user.type(screen.getByRole("textbox", { name: "trigger" }), "x");

      expect(await screen.findByRole("textbox", { name: "watcher" })).toBeInTheDocument();
    });

    it("preserves a set_variable write across a host re-render with a fresh context wrapper", async () => {
      const user = userEvent.setup();
      const schema = countingSchema();
      const registry = createDefaultRegistry();
      // Stable registries reference across both renders, so only the fresh
      // `evaluationContext` wrapper differs between them.
      const registries = { pc: registry, mobile: registry };

      const { rerender } = render(
        <RegistryProvider registries={registries}>
          <FormRenderer evaluationContext={{}} schema={schema} />
        </RegistryProvider>
      );

      await user.type(screen.getByRole("textbox", { name: "trigger" }), "x");
      expect(await screen.findByRole("textbox", { name: "watcher" })).toBeInTheDocument();

      // A fresh `evaluationContext` wrapper (stable inner) must NOT re-seed `$vars`
      // and clobber the `set_variable` write — the watcher stays visible.
      rerender(
        <RegistryProvider registries={registries}>
          <FormRenderer evaluationContext={{}} schema={schema} />
        </RegistryProvider>
      );

      expect(screen.getByRole("textbox", { name: "watcher" })).toBeInTheDocument();
    });
  });

  describe("refresh_data_source", () => {
    it("re-resolves a ref data source through the resolver when the effect fires", async () => {
      const user = userEvent.setup();
      const resolver: DataSourceResolver = { resolve: vi.fn().mockResolvedValue([{ label: "北京", value: "bj" }]) };

      renderForm(<FormRenderer dataSourceResolver={resolver} schema={refreshDataSourceSchema()} />);

      // The picker resolves its remote source once on mount.
      await waitFor(() => expect(resolver.resolve).toHaveBeenCalledTimes(1));

      // Typing fires change → refresh_data_source, bumping the version → one re-fetch.
      await user.type(screen.getByRole("textbox", { name: "trigger" }), "x");

      await waitFor(() => expect(resolver.resolve).toHaveBeenCalledTimes(2));
    });
  });

  describe("subform row identity", () => {
    it("does not replay a surviving row's condition effects when an earlier row is removed", async () => {
      const user = userEvent.setup();
      const dispatchEffect = vi.fn();
      const subform: SubformNode = {
        id: "Sub_lines",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [
          field("flag", {
            linkage: {
              rules: [
                {
                  id: "R1",
                  trigger: {
                    kind: "condition",
                    condition: {
                      kind: "leaf",
                      sourceKey: "flag",
                      operator: "notEmpty"
                    }
                  },
                  actions: [{ type: "alert", message: { kind: "literal", value: "hi" } }]
                }
              ]
            }
          })
        ]
      };

      // Row 0's condition is false, row 1's is already true (seeded silently on
      // mount). Removing row 0 must keep row 1's component instance — its key,
      // not its index, is its identity — so the surviving row's tracker still
      // holds `true` and nothing re-fires. With index keys, instance 0 would
      // receive row 1's values and read a false→true rising edge.
      renderForm(
        <FormRenderer
          defaultValues={{ lines: [{ flag: "" }, { flag: "x" }] }}
          evaluators={{ dispatchEffect }}
          schema={stack(subform)}
        />
      );

      // `getAllByRole` throws on zero matches, so the first button exists.
      const removeButtons = screen.getAllByRole("button", { name: "删除此行" });
      expect(removeButtons).toHaveLength(2);
      await user.click(removeButtons[0]!);

      expect(screen.getAllByRole("textbox", { name: "flag" })).toHaveLength(1);
      expect(dispatchEffect).not.toHaveBeenCalled();
    });
  });

  describe("schema swap", () => {
    it("re-seeds condition edges so an already-true condition does not fire after a swap", () => {
      const dispatchEffect = vi.fn();
      // `before` seeds the edge tracker with a non-null truth vector (its rule is
      // false on mount: `a` is empty, so `notEmpty` is false).
      const before: FormSchema = stack(
        field("a", {
          linkage: {
            rules: [
              {
                id: "R0",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "a",
                    operator: "notEmpty"
                  }
                },
                actions: [{ type: "alert", message: { kind: "literal", value: "before" } }]
              }
            ]
          }
        })
      );
      // `after` swaps in a different rule whose condition is already true (`a` is
      // empty). Without a re-seed, the stale `[false]` vector reads as a rising
      // edge and fires spuriously.
      const after: FormSchema = stack(
        field("a", {
          linkage: {
            rules: [
              {
                id: "R1",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "a",
                    operator: "empty"
                  }
                },
                actions: [{ type: "alert", message: { kind: "literal", value: "x" } }]
              }
            ]
          }
        })
      );

      const registry = createDefaultRegistry();
      const { rerender } = render(
        <RegistryProvider registries={{ pc: registry, mobile: registry }}>
          <FormRenderer evaluators={{ dispatchEffect }} schema={before} />
        </RegistryProvider>
      );

      // Swap in a schema whose condition (`a` is empty) is already true. A swap
      // re-seeds the edge tracker, so it must NOT fire on the new schema's mount.
      rerender(
        <RegistryProvider registries={{ pc: registry, mobile: registry }}>
          <FormRenderer evaluators={{ dispatchEffect }} schema={after} />
        </RegistryProvider>
      );

      expect(dispatchEffect).not.toHaveBeenCalled();
    });
  });
});
