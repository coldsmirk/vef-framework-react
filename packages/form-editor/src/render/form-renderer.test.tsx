import type * as ComponentsModule from "@vef-framework-react/components";
import type { CodeEditorProps } from "@vef-framework-react/components";
import type { ChangeEvent, ReactElement, ReactNode } from "react";

import type { Block, ButtonField, CodeEditorField, FormSchema, NumberField, SubformNode, TextfieldField } from "../types";
import type { FormRendererApi } from "./form-renderer";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";

vi.mock("@vef-framework-react/components", async importOriginal => {
  const actual = await importOriginal<typeof ComponentsModule>();

  function CodeEditor(props: CodeEditorProps): ReactElement {
    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
      props.onChange?.(event.target.value);
    };

    return (
      <textarea
        aria-label="mock-code-editor"
        defaultValue={props.value}
        readOnly={props.readOnly}
        onChange={handleChange}
      />
    );
  }

  return {
    ...actual,
    CodeEditor
  };
});

function makeField(key: string, overrides: Partial<TextfieldField> = {}): TextfieldField {
  return {
    id: `Field_${key}`,
    type: "textfield",
    key,
    label: key,
    ...overrides
  };
}

function makeNumberField(key: string, overrides: Partial<NumberField> = {}): NumberField {
  return {
    id: `Field_${key}`,
    type: "number",
    key,
    label: key,
    ...overrides
  };
}

function makeCodeEditor(key: string, overrides: Partial<CodeEditorField> = {}): CodeEditorField {
  return {
    id: `Field_${key}`,
    type: "code-editor",
    key,
    label: key,
    language: "json",
    minHeight: 160,
    showLineNumbers: true,
    ...overrides
  };
}

function submitButton(): ButtonField {
  return {
    id: "Field_submit",
    type: "button",
    label: "提交",
    action: "submit"
  };
}

/**
 * A vertical stack of blocks.
 */
function stack(...blocks: Block[]): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children: blocks } }
  };
}

/**
 * A form with a root field `name` plus a subform whose key varies — used to
 * check that changing the subform key signs a new form id (and so rebuilds).
 */
function subformSchema(subformKey: string): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          makeField("name"),
          {
            id: "Subform_x",
            type: "subform",
            variant: "stack",
            key: subformKey,
            label: "明细",
            template: [makeField("amount")]
          }
        ]
      }
    }
  };
}

/**
 * A section hidden by linkage when `mode` equals "off", wrapping `inner`.
 */
function hiddenSectionSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          makeField("mode"),
          {
            id: "Sec_1",
            type: "section",
            variant: "card",
            title: "分组",
            children: [makeField("inner")],
            linkage: {
              rules: [
                {
                  id: "Rule_hide",
                  trigger: {
                    kind: "condition",
                    condition: {
                      kind: "leaf",
                      sourceKey: "mode",
                      operator: "eq",
                      value: "off"
                    }
                  },
                  actions: [{ type: "hide" }]
                }
              ]
            }
          },
          submitButton()
        ]
      }
    }
  };
}

/**
 * Tab A holds a plain field; tab B holds a required one. antd mounts tab
 * panes lazily, so `code` has no mounted validator until tab B is visited.
 */
function tabbedSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Tabs_1",
            type: "tabs",
            tabs: [
              {
                id: "Tab_a",
                label: "基础",
                children: [makeField("name")]
              },
              {
                id: "Tab_b",
                label: "高级",
                children: [makeField("code", { validate: { required: true } })]
              }
            ]
          },
          submitButton()
        ]
      }
    }
  };
}

/**
 * `code` is computed from `type`; `gate` flips on `flag` — an unrelated
 * runtime-state change that must not re-assert the assignment.
 */
function assignSchema(): FormSchema {
  return stack(
    makeField("type"),
    makeField("flag"),
    makeField("code", {
      linkage: {
        rules: [
          {
            id: "Rule_a",
            trigger: {
              kind: "condition",
              condition: {
                kind: "leaf",
                sourceKey: "type",
                operator: "eq",
                value: "a"
              }
            },
            actions: [{ type: "assign", value: { kind: "literal", value: "A001" } }]
          },
          {
            id: "Rule_b",
            trigger: {
              kind: "condition",
              condition: {
                kind: "leaf",
                sourceKey: "type",
                operator: "eq",
                value: "b"
              }
            },
            actions: [{ type: "assign", value: { kind: "literal", value: "B002" } }]
          }
        ]
      }
    }),
    makeField("gate", {
      linkage: {
        defaults: { hidden: true },
        rules: [
          {
            id: "Rule_gate",
            trigger: {
              kind: "condition",
              condition: {
                kind: "leaf",
                sourceKey: "flag",
                operator: "eq",
                value: "x"
              }
            },
            actions: [{ type: "show" }]
          }
        ]
      }
    })
  );
}

function renderRuntime(children: ReactNode): void {
  const registry = createDefaultRegistry();

  render(
    <RegistryProvider registries={{ pc: registry, mobile: registry }}>
      {children}
    </RegistryProvider>
  );
}

describe("FormRenderer", () => {
  it("manages field values through TanStack Form", async () => {
    const user = userEvent.setup();

    renderRuntime(<FormRenderer schema={stack(makeField("name"))} />);

    const input = screen.getByRole("textbox", { name: "name" }) as HTMLInputElement;
    await user.type(input, "hello");

    expect(input).toHaveValue("hello");
  });

  it("renders containers through the active registry's chrome", () => {
    const registry = createDefaultRegistry();
    registry.setContainerChrome({
      ...registry.getContainerChrome(),
      Section: ({ children, title }) => (
        <section data-testid="custom-section">
          <h3>{title}</h3>
          {children}
        </section>
      )
    });
    const schema: FormSchema = {
      id: "Form_1",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Sec_1",
              type: "section",
              variant: "card",
              title: "分组",
              children: [makeField("inner")]
            }
          ]
        }
      }
    };

    render(
      <RegistryProvider registries={{ pc: registry, mobile: registry }}>
        <FormRenderer schema={schema} />
      </RegistryProvider>
    );

    expect(screen.getByTestId("custom-section")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "inner" })).toBeInTheDocument();
  });

  it("applies show linkage rules from source field values", async () => {
    const user = userEvent.setup();
    const schema = stack(
      makeField("type"),
      makeField("code", {
        linkage: {
          defaults: { hidden: true },
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "eq",
                  value: "enterprise"
                }
              },
              actions: [{ type: "show" }]
            }
          ]
        }
      })
    );

    renderRuntime(<FormRenderer schema={schema} />);

    expect(screen.queryByRole("textbox", { name: "code" })).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "type" }), "enterprise");

    expect(await screen.findByRole("textbox", { name: "code" })).toBeInTheDocument();
  });

  it("drops a hidden grid cell, keeping its visible sibling", () => {
    const schema: FormSchema = {
      id: "Form_1",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Grid_1",
              type: "grid",
              columns: 2,
              children: [
                makeField("visible"),
                makeField("gone", { linkage: { defaults: { hidden: true } } })
              ]
            }
          ]
        }
      }
    };

    renderRuntime(<FormRenderer schema={schema} />);

    expect(screen.getByRole("textbox", { name: "visible" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "gone" })).not.toBeInTheDocument();
  });

  it("updates assigned values without making the form uncontrolled", async () => {
    const user = userEvent.setup();
    const schema = stack(
      makeField("type"),
      makeField("code", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "eq",
                  value: "enterprise"
                }
              },
              actions: [{ type: "assign", value: { kind: "literal", value: "A001" } }]
            }
          ]
        }
      })
    );

    renderRuntime(<FormRenderer schema={schema} />);

    await user.type(screen.getByRole("textbox", { name: "type" }), "enterprise");

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "code" })).toHaveValue("A001");
    });
  });

  it("validates dynamic required rules on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema = stack(
      makeField("type"),
      makeField("code", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "eq",
                  value: "enterprise"
                }
              },
              actions: [{ type: "require" }]
            }
          ]
        }
      }),
      submitButton()
    );

    renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox", { name: "type" }), "enterprise");
    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("此项为必填");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a value shorter than minLength on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema = stack(makeField("name", { validate: { minLength: 3 } }), submitButton());

    renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox", { name: "name" }), "ab");
    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("最少 3 个字符");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts a value that meets minLength", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema = stack(makeField("name", { validate: { minLength: 3 } }), submitButton());

    renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox", { name: "name" }), "abc");
    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "abc" }));
  });

  it("shows the custom validate message when a rule fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema = stack(
      makeField("name", { validate: { minLength: 3, message: "名称太短了" } }),
      submitButton()
    );

    renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox", { name: "name" }), "ab");
    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("名称太短了");
  });

  it("rejects a value that does not match the pattern", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema = stack(makeField("phone", { validate: { pattern: String.raw`^1\d{10}$` } }), submitButton());

    renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox", { name: "phone" }), "abc");
    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("格式不正确");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not apply constraint rules to an empty optional field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema = stack(makeField("name", { validate: { minLength: 3 } }), submitButton());

    renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

    // Never touched, so empty — an optional field's constraints must not fire.
    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "" }));
  });

  it("rejects a number below the validate min on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema = stack(makeNumberField("qty", { validate: { min: 10 } }), submitButton());

    renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

    await user.type(screen.getByRole("spinbutton", { name: "qty" }), "5");
    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("不能小于 10");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("omits hidden field values from submitted payloads", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema = stack(
      makeField("type"),
      makeField("secret", {
        linkage: {
          defaults: { hidden: true },
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "eq",
                  value: "show"
                }
              },
              actions: [{ type: "show" }]
            }
          ]
        }
      }),
      submitButton()
    );

    renderRuntime(<FormRenderer defaultValues={{ secret: "persisted" }} schema={schema} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(onSubmit).toHaveBeenCalledWith({ type: "" });
  });

  it("submits code editor values through TanStack Form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema = stack(makeCodeEditor("code"), submitButton());

    renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

    await user.type(await screen.findByRole("textbox", { name: "mock-code-editor" }), "return true");
    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(onSubmit).toHaveBeenCalledWith({ code: "return true" });
  });

  it("submits subform rows as an array of records", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const subform: SubformNode = {
      id: "Subform_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      label: "明细",
      addLabel: "新增一行",
      template: [makeField("amount")]
    };
    const schema = stack(subform, submitButton());

    renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /新增一行/ }));
    await user.type(screen.getByRole("textbox", { name: "amount" }), "100");
    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(onSubmit).toHaveBeenCalledWith({ lines: [{ amount: "100" }] });
  });

  it("strips per-row hidden field values from the submitted subform array", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const subform: SubformNode = {
      id: "Subform_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      template: [
        makeField("category"),
        makeField("note", {
          linkage: {
            defaults: { hidden: true },
            rules: [
              {
                id: "Rule_note",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "category",
                    operator: "eq",
                    value: "other"
                  }
                },
                actions: [{ type: "show" }]
              }
            ]
          }
        })
      ]
    };
    const schema = stack(subform, submitButton());

    // Row 0: category "food" → note hidden; row 1: category "other" → note shown.
    // Both row records carry a `note` value.
    renderRuntime(
      <FormRenderer
        defaultValues={{ lines: [{ category: "food", note: "hidden-secret" }, { category: "other", note: "kept" }] }}
        schema={schema}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole("button", { name: "提交" }));

    // Row 0's note is hidden, so its value is stripped; row 1's note is visible,
    // so it is kept — symmetric with how a hidden root field is stripped.
    expect(onSubmit).toHaveBeenCalledWith({
      lines: [{ category: "food" }, { category: "other", note: "kept" }]
    });
  });

  it("evaluates hide linkage against the row's own values inside a subform", async () => {
    const user = userEvent.setup();
    const subform: SubformNode = {
      id: "Subform_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      label: "明细",
      addLabel: "新增一行",
      template: [
        makeField("category"),
        makeField("note", {
          linkage: {
            defaults: { hidden: true },
            rules: [
              {
                id: "Rule_note",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "category",
                    operator: "eq",
                    value: "other"
                  }
                },
                actions: [{ type: "show" }]
              }
            ]
          }
        })
      ]
    };

    renderRuntime(<FormRenderer schema={stack(subform)} />);

    await user.click(screen.getByRole("button", { name: /新增一行/ }));

    expect(screen.queryByRole("textbox", { name: "note" })).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "category" }), "other");

    expect(await screen.findByRole("textbox", { name: "note" })).toBeInTheDocument();
  });

  it("applies assign linkage against the row api inside a subform", async () => {
    const user = userEvent.setup();
    const subform: SubformNode = {
      id: "Subform_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      label: "明细",
      addLabel: "新增一行",
      template: [
        makeField("category"),
        makeField("code", {
          linkage: {
            rules: [
              {
                id: "Rule_code",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "category",
                    operator: "eq",
                    value: "vip"
                  }
                },
                actions: [{ type: "assign", value: { kind: "literal", value: "A001" } }]
              }
            ]
          }
        })
      ]
    };

    renderRuntime(<FormRenderer schema={stack(subform)} />);

    await user.click(screen.getByRole("button", { name: /新增一行/ }));
    await user.type(screen.getByRole("textbox", { name: "category" }), "vip");

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "code" })).toHaveValue("A001");
    });
  });

  it("removes a subform row and drops it from the submitted array", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const subform: SubformNode = {
      id: "Subform_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      label: "明细",
      addLabel: "新增一行",
      template: [makeField("amount")]
    };

    renderRuntime(<FormRenderer schema={stack(subform, submitButton())} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /新增一行/ }));
    await user.type(screen.getByRole("textbox", { name: "amount" }), "100");
    await user.click(screen.getByRole("button", { name: "删除此行" }));
    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(onSubmit).toHaveBeenCalledWith({ lines: [] });
  });

  it("seeds minRows blank rows on mount", () => {
    const subform: SubformNode = {
      id: "Subform_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      label: "明细",
      addLabel: "新增一行",
      minRows: 2,
      template: [makeField("amount")]
    };

    renderRuntime(<FormRenderer schema={stack(subform)} />);

    expect(screen.getAllByRole("textbox", { name: "amount" })).toHaveLength(2);
  });

  it("hides the add control once maxRows is reached", async () => {
    const user = userEvent.setup();
    const subform: SubformNode = {
      id: "Subform_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      label: "明细",
      addLabel: "新增一行",
      maxRows: 1,
      template: [makeField("amount")]
    };

    renderRuntime(<FormRenderer schema={stack(subform)} />);

    await user.click(screen.getByRole("button", { name: /新增一行/ }));

    expect(screen.queryByRole("button", { name: /新增一行/ })).not.toBeInTheDocument();
  });

  it("marks a field required when a runtime require rule fires", async () => {
    const user = userEvent.setup();
    const schema = stack(
      makeField("type"),
      makeField("code", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "eq",
                  value: "enterprise"
                }
              },
              actions: [{ type: "require" }]
            }
          ]
        }
      })
    );

    renderRuntime(<FormRenderer schema={schema} />);

    expect(screen.queryByText("*")).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "type" }), "enterprise");

    expect(await screen.findByText("*")).toBeInTheDocument();
  });

  it("rebuilds the form when a subform key changes so a touched preview drops stale state", async () => {
    const user = userEvent.setup();
    const registry = createDefaultRegistry();

    const { rerender } = render(
      <RegistryProvider registries={{ pc: registry, mobile: registry }}>
        <FormRenderer schema={subformSchema("lines")} />
      </RegistryProvider>
    );

    await user.type(screen.getByRole("textbox", { name: "name" }), "hello");
    expect(screen.getByRole("textbox", { name: "name" })).toHaveValue("hello");

    rerender(
      <RegistryProvider registries={{ pc: registry, mobile: registry }}>
        <FormRenderer schema={subformSchema("items")} />
      </RegistryProvider>
    );

    // The subform key is signed into the form id, so TanStack Form rebuilds with
    // fresh defaults instead of retaining the touched value (it only re-seeds on
    // a form-id change). Before the fix the id ignored subforms, so "hello" stuck.
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "name" })).toHaveValue("");
    });
  });

  it("disables every field inside a container when a disable rule fires on it", async () => {
    const user = userEvent.setup();
    const schema: FormSchema = {
      id: "Form_1",
      version: 2,
      presentations: {
        pc: {
          children: [
            makeField("trigger"),
            {
              id: "Sec_1",
              type: "section",
              variant: "card",
              title: "卡片",
              children: [makeField("inner")],
              linkage: {
                rules: [
                  {
                    id: "Rule_1",
                    trigger: {
                      kind: "condition",
                      condition: {
                        kind: "leaf",
                        sourceKey: "trigger",
                        operator: "eq",
                        value: "x"
                      }
                    },
                    actions: [{ type: "disable" }]
                  }
                ]
              }
            }
          ]
        }
      }
    };

    renderRuntime(<FormRenderer schema={schema} />);

    expect(screen.getByRole("textbox", { name: "inner" })).toBeEnabled();

    await user.type(screen.getByRole("textbox", { name: "trigger" }), "x");

    expect(screen.getByRole("textbox", { name: "inner" })).toBeDisabled();
  });

  it("does not block submission on a required field inside a disabled container", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema: FormSchema = {
      id: "Form_1",
      version: 2,
      presentations: {
        pc: {
          children: [
            makeField("trigger"),
            {
              id: "Sec_1",
              type: "section",
              variant: "card",
              title: "卡片",
              children: [makeField("inner", { validate: { required: true } })],
              linkage: {
                rules: [
                  {
                    id: "Rule_1",
                    trigger: {
                      kind: "condition",
                      condition: {
                        kind: "leaf",
                        sourceKey: "trigger",
                        operator: "eq",
                        value: "x"
                      }
                    },
                    actions: [{ type: "disable" }]
                  }
                ]
              }
            },
            submitButton()
          ]
        }
      }
    };

    renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

    // Disabling the container must also exempt its required `inner` field from
    // the required check — the user cannot edit a disabled field, so it must
    // not hold the form hostage.
    await user.type(screen.getByRole("textbox", { name: "trigger" }), "x");
    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ trigger: "x", inner: "" }));
  });

  describe("effective hidden on submit", () => {
    it("strips a field inside a linkage-hidden section from the payload", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderRuntime(
        <FormRenderer
          defaultValues={{ mode: "off", inner: "persisted" }}
          schema={hiddenSectionSchema()}
          onSubmit={onSubmit}
        />
      );

      // The section (and so `inner`) is hidden; its value must not submit even
      // though `inner`'s OWN linkage says nothing.
      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ mode: "off" }));
    });

    it("keeps the field when the section is visible", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderRuntime(
        <FormRenderer
          defaultValues={{ mode: "on", inner: "kept" }}
          schema={hiddenSectionSchema()}
          onSubmit={onSubmit}
        />
      );

      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ mode: "on", inner: "kept" }));
    });

    it("strips a hidden-section descendant inside a subform row", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const subform: SubformNode = {
        id: "Subform_lines",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [
          makeField("category"),
          {
            id: "Sec_row",
            type: "section",
            variant: "card",
            title: "备注",
            children: [makeField("note")],
            linkage: {
              rules: [
                {
                  id: "Rule_hide_row",
                  trigger: {
                    kind: "condition",
                    condition: {
                      kind: "leaf",
                      sourceKey: "category",
                      operator: "eq",
                      value: "food"
                    }
                  },
                  actions: [{ type: "hide" }]
                }
              ]
            }
          }
        ]
      };

      renderRuntime(
        <FormRenderer
          schema={stack(subform, submitButton())}
          defaultValues={{
            lines: [
              { category: "food", note: "stripped" },
              { category: "other", note: "kept" }
            ]
          }}
          onSubmit={onSubmit}
        />
      );

      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          lines: [{ category: "food" }, { category: "other", note: "kept" }]
        });
      });
    });
  });

  describe("schema-driven submit validation", () => {
    it("blocks submission on a required field inside a never-activated tab", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderRuntime(<FormRenderer schema={tabbedSchema()} onSubmit={onSubmit} />);

      // Tab B was never activated, so `code` never mounted a field validator —
      // the schema-driven submit gate must still block the submission.
      expect(screen.queryByRole("textbox", { name: "code" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "提交" }));

      expect(onSubmit).not.toHaveBeenCalled();

      // Visiting the pane mounts the field, which surfaces the recorded error.
      await user.click(screen.getByRole("tab", { name: "高级" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("此项为必填");
    });

    it("submits after the required field in the other tab is filled", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderRuntime(<FormRenderer schema={tabbedSchema()} onSubmit={onSubmit} />);

      await user.click(screen.getByRole("tab", { name: "高级" }));
      await user.type(screen.getByRole("textbox", { name: "code" }), "C42");
      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ name: "", code: "C42" });
      });
    });

    it("does not block submission on a required field hidden by an ancestor", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const schema: FormSchema = {
        id: "Form_1",
        version: 2,
        presentations: {
          pc: {
            children: [
              {
                id: "Sec_1",
                type: "section",
                variant: "card",
                title: "隐藏分组",
                children: [makeField("inner", { validate: { required: true } })],
                linkage: { defaults: { hidden: true } }
              },
              submitButton()
            ]
          }
        }
      };

      renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

      // `inner` is required but effectively hidden (its section is hidden), so
      // it neither submits nor blocks.
      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({}));
    });

    it("blocks submission on a required field inside an unvisited subform-row section", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const subform: SubformNode = {
        id: "Subform_lines",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [makeField("amount", { validate: { required: true } })]
      };

      renderRuntime(
        <FormRenderer
          defaultValues={{ lines: [{ amount: "" }] }}
          schema={stack(subform, submitButton())}
          onSubmit={onSubmit}
        />
      );

      await user.click(screen.getByRole("button", { name: "提交" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("此项为必填");
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("assign semantics", () => {
    it("keeps a manual override while unrelated runtime state flips", async () => {
      const user = userEvent.setup();

      renderRuntime(<FormRenderer schema={assignSchema()} />);

      await user.type(screen.getByRole("textbox", { name: "type" }), "a");
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "code" })).toHaveValue("A001");
      });

      // The user overrides the computed value — "computed but editable".
      const code = screen.getByRole("textbox", { name: "code" });
      await user.clear(code);
      await user.type(code, "MINE");
      expect(code).toHaveValue("MINE");

      // Flipping `gate` changes the runtime-state map; the assignment must NOT
      // be re-asserted off that unrelated change.
      await user.type(screen.getByRole("textbox", { name: "flag" }), "x");
      expect(await screen.findByRole("textbox", { name: "gate" })).toBeInTheDocument();

      expect(screen.getByRole("textbox", { name: "code" })).toHaveValue("MINE");
    });

    it("replaces an override when the computed value changes", async () => {
      const user = userEvent.setup();

      renderRuntime(<FormRenderer schema={assignSchema()} />);

      const type = screen.getByRole("textbox", { name: "type" });
      await user.type(type, "a");
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "code" })).toHaveValue("A001");
      });

      const code = screen.getByRole("textbox", { name: "code" });
      await user.clear(code);
      await user.type(code, "MINE");

      // A new computed value wins over the override — the assignment applies
      // once per computed-value change.
      await user.clear(type);
      await user.type(type, "b");

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "code" })).toHaveValue("B002");
      });
    });
  });

  describe("apiRef", () => {
    it("submits, resets, and reads values through the imperative handle", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const api = createRef<FormRendererApi>();

      renderRuntime(<FormRenderer apiRef={api} schema={stack(makeField("name"))} onSubmit={onSubmit} />);

      await user.type(screen.getByRole("textbox", { name: "name" }), "hello");
      expect(api.current?.getValues()).toMatchObject({ name: "hello" });

      // Host-driven submit (a Modal footer button) runs the same pipeline as
      // a schema submit button.
      await act(async () => {
        await api.current?.submit();
      });
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "hello" }));

      act(() => {
        api.current?.reset();
      });
      expect(screen.getByRole("textbox", { name: "name" })).toHaveValue("");
    });
  });
});
