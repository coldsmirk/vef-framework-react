import type { ReactNode } from "react";
import type { Mock } from "vitest";

import type {
  Block,
  ButtonField,
  FieldLinkageRule,
  FieldPermission,
  FormSchema,
  StackSubform,
  SubformNode,
  TextfieldField
} from "../types";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";

/**
 * Server-authoritative `fieldPermissions` coverage. The map is the OUTER bound
 * on per-field interactivity — linkage may narrow within it but never widen
 * past it — and a non-writable key never reaches the submit payload nor blocks
 * validation. An absent prop (or absent key) must leave every existing
 * behavior untouched.
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

function submitButton(): ButtonField {
  return {
    id: "Field_submit",
    type: "button",
    label: "提交",
    action: "submit"
  };
}

function stack(...blocks: Block[]): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children: blocks } }
  };
}

/**
 * A condition rule firing `actions` when `sourceKey` equals `value`.
 */
function whenEq(sourceKey: string, value: string, actions: FieldLinkageRule["actions"]): FieldLinkageRule {
  return {
    id: `Rule_${sourceKey}_${value}`,
    trigger: {
      kind: "condition",
      condition: {
        kind: "leaf",
        sourceKey,
        operator: "eq",
        value
      }
    },
    actions
  };
}

function stackSubform(overrides: Partial<StackSubform> = {}): SubformNode {
  return {
    id: "Subform_lines",
    type: "subform",
    variant: "stack",
    key: "lines",
    label: "明细",
    template: [field("amount")],
    ...overrides
  };
}

function tableSubform(): SubformNode {
  return {
    id: "Subform_lines",
    type: "subform",
    variant: "table",
    key: "lines",
    label: "明细",
    template: [field("amount")]
  };
}

function renderRuntime(children: ReactNode): void {
  const registry = createDefaultRegistry();

  render(
    <RegistryProvider registries={{ pc: registry, mobile: registry }}>
      {children}
    </RegistryProvider>
  );
}

describe("FormRenderer field permissions", () => {
  it("does not mount a hidden-clamped field and drops its value from the payload", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderRuntime(
      <FormRenderer
        defaultValues={{ name: "n", secret: "s3cret" }}
        fieldPermissions={{ secret: "hidden" }}
        schema={stack(field("name"), field("secret"), submitButton())}
        onSubmit={onSubmit}
      />
    );

    expect(
      screen.queryByRole("textbox", { name: "secret" }),
      "a hidden-clamped field must never mount"
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(onSubmit, "the hidden-clamped value must not reach the payload").toHaveBeenCalledWith({ name: "n" });
    });
  });

  it("renders a visible-clamped field read-only", () => {
    renderRuntime(
      <FormRenderer
        defaultValues={{ readonly: "server-value" }}
        fieldPermissions={{ readonly: "visible" }}
        schema={stack(field("readonly"))}
      />
    );

    const input = screen.getByRole("textbox", { name: "readonly" });
    expect(input, "the field stays mounted for display").toHaveValue("server-value");
    expect(input, "visible means read-only through the disabled channel").toBeDisabled();
  });

  it("excludes a visible-clamped field from the payload and exempts it from its static required rule", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderRuntime(
      <FormRenderer
        defaultValues={{ name: "n" }}
        fieldPermissions={{ readonly: "visible" }}
        schema={stack(field("name"), field("readonly", { validate: { required: true } }), submitButton())}
        onSubmit={onSubmit}
      />
    );

    // `readonly` is empty and statically required — without the clamp this
    // submission would block; the read-only exemption lets it through with the
    // key excluded from the payload.
    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(
        onSubmit,
        "a read-only field is exempt from validation and excluded from the payload"
      ).toHaveBeenCalledWith({ name: "n" });
    });
  });

  it("fails an empty required-clamped field without a static rule", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderRuntime(
      <FormRenderer
        fieldPermissions={{ code: "required" }}
        schema={stack(field("code"), submitButton())}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole("button", { name: "提交" }));

    expect(
      await screen.findByRole("alert"),
      "the required clamp must surface the empty-value error"
    ).toHaveTextContent("此项为必填");
    expect(onSubmit, "an empty required-clamped field must block submission").not.toHaveBeenCalled();
  });

  it("marks a required-clamped field with the required indicator", () => {
    renderRuntime(<FormRenderer fieldPermissions={{ code: "required" }} schema={stack(field("code"))} />);

    expect(screen.getByText("*"), "the label must carry the required marker").toBeInTheDocument();
  });

  it("treats an editable-clamped field exactly as unclamped", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderRuntime(
      <FormRenderer
        fieldPermissions={{ name: "editable" }}
        schema={stack(field("name"), submitButton())}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByRole("textbox", { name: "name" });
    expect(input, "an editable clamp changes nothing").toBeEnabled();

    await user.type(input, "hello");
    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(onSubmit, "the editable value submits as it does today").toHaveBeenCalledWith({ name: "hello" });
    });
  });

  describe("interaction with linkage", () => {
    it("keeps a visible-clamped field read-only when show and enable rules fire", async () => {
      const user = userEvent.setup();
      const widen: Partial<TextfieldField> = {
        linkage: {
          defaults: { disabled: true },
          rules: [whenEq("type", "x", [{ type: "enable" }, { type: "show" }])]
        }
      };
      // `mirror` shares the linkage but carries no clamp — it proves the enable
      // rule actually fired, so the `locked` assertion cannot pass vacuously.
      const schema = stack(field("type"), field("locked", widen), field("mirror", widen));

      renderRuntime(<FormRenderer fieldPermissions={{ locked: "visible" }} schema={schema} />);

      await user.type(screen.getByRole("textbox", { name: "type" }), "x");

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "mirror" }), "the enable rule fired").toBeEnabled();
      });
      expect(
        screen.getByRole("textbox", { name: "locked" }),
        "linkage must not widen a field past its non-writable clamp"
      ).toBeDisabled();
    });

    it("hides an editable-clamped field when a hide rule fires", async () => {
      const user = userEvent.setup();
      const schema = stack(
        field("type"),
        field("code", { linkage: { rules: [whenEq("type", "x", [{ type: "hide" }])] } })
      );

      renderRuntime(<FormRenderer fieldPermissions={{ code: "editable" }} schema={schema} />);

      expect(screen.getByRole("textbox", { name: "code" }), "code starts visible").toBeInTheDocument();

      await user.type(screen.getByRole("textbox", { name: "type" }), "x");

      await waitFor(() => {
        expect(
          screen.queryByRole("textbox", { name: "code" }),
          "linkage may narrow (hide) within an editable clamp"
        ).not.toBeInTheDocument();
      });
    });

    it("keeps a required clamp over a fired optional rule", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const schema = stack(
        field("type"),
        field("code", {
          linkage: {
            defaults: { required: true },
            rules: [whenEq("type", "x", [{ type: "optional" }])]
          }
        }),
        submitButton()
      );

      renderRuntime(<FormRenderer fieldPermissions={{ code: "required" }} schema={schema} onSubmit={onSubmit} />);

      // The optional rule fires, but the clamp is the outer bound — the empty
      // field must still fail the required check.
      await user.type(screen.getByRole("textbox", { name: "type" }), "x");
      await user.click(screen.getByRole("button", { name: "提交" }));

      expect(
        await screen.findByRole("alert"),
        "the required clamp must win over the linkage optional outcome"
      ).toHaveTextContent("此项为必填");
      expect(onSubmit, "the empty required-clamped field must block submission").not.toHaveBeenCalled();
    });

    it("suppresses an assign into a visible-clamped field but applies it to an editable one", async () => {
      const user = userEvent.setup();
      const schema = stack(
        field("type"),
        field("code", {
          linkage: { rules: [whenEq("type", "a", [{ type: "assign", value: { kind: "literal", value: "A001" } }])] }
        }),
        field("mirror", {
          linkage: { rules: [whenEq("type", "a", [{ type: "assign", value: { kind: "literal", value: "M001" } }])] }
        })
      );

      renderRuntime(<FormRenderer fieldPermissions={{ code: "visible", mirror: "editable" }} schema={schema} />);

      await user.type(screen.getByRole("textbox", { name: "type" }), "a");

      // The editable assignment landing proves the assignment pass ran.
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "mirror" }), "the editable-clamped assign applies").toHaveValue("M001");
      });
      expect(
        screen.getByRole("textbox", { name: "code" }),
        "no phantom edit may land in a non-writable field"
      ).toHaveValue("");
    });
  });

  describe("subform clamp", () => {
    it("renders a visible-clamped stack subform read-only", () => {
      renderRuntime(
        <FormRenderer
          defaultValues={{ lines: [{ amount: "1" }] }}
          fieldPermissions={{ lines: "visible" }}
          schema={stack(stackSubform({ addLabel: "新增一行" }))}
        />
      );

      expect(screen.getByRole("textbox", { name: "amount" }), "row fields render disabled").toBeDisabled();
      expect(
        screen.queryByRole("button", { name: /新增一行/ }),
        "a read-only subform offers no add control"
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "删除此行" }),
        "a read-only subform offers no remove control"
      ).not.toBeInTheDocument();
    });

    it("does not mount a hidden-clamped stack subform and drops its rows from the payload", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderRuntime(
        <FormRenderer
          defaultValues={{ name: "n", lines: [{ amount: "1" }] }}
          fieldPermissions={{ lines: "hidden" }}
          schema={stack(field("name"), stackSubform(), submitButton())}
          onSubmit={onSubmit}
        />
      );

      expect(
        screen.queryByRole("textbox", { name: "amount" }),
        "a hidden-clamped subform must never mount"
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => {
        expect(onSubmit, "the hidden-clamped subform's rows must not reach the payload").toHaveBeenCalledWith({ name: "n" });
      });
    });

    it("renders a visible-clamped table subform read-only", () => {
      renderRuntime(
        <FormRenderer
          defaultValues={{ lines: [{ amount: "42" }] }}
          fieldPermissions={{ lines: "visible" }}
          schema={stack(tableSubform())}
        />
      );

      // The cell value renders — the table itself is mounted, so the absent
      // controls below cannot pass vacuously.
      expect(screen.getByText("42"), "the table renders its rows for display").toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /新增记录/ }),
        "a read-only table subform offers no add control"
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "编辑" }),
        "a read-only table subform offers no row editing"
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "删除" }),
        "a read-only table subform offers no row deletion"
      ).not.toBeInTheDocument();
    });

    it("does not mount a hidden-clamped table subform", () => {
      renderRuntime(
        <FormRenderer
          defaultValues={{ lines: [{ amount: "42" }] }}
          fieldPermissions={{ lines: "hidden" }}
          schema={stack(tableSubform())}
        />
      );

      expect(screen.queryByText("明细"), "the subform chrome must not mount").not.toBeInTheDocument();
      expect(screen.queryByText("42"), "no row content may render").not.toBeInTheDocument();
    });
  });

  describe("absent clamp", () => {
    it("leaves existing behavior unchanged when the prop is absent", async () => {
      const onSubmit = await runUnclampedScenario(undefined);

      await waitFor(() => {
        expect(onSubmit, "the payload matches the unclamped pipeline").toHaveBeenCalledWith({
          type: "enterprise",
          code: "C42"
        });
      });
    });

    it("leaves existing behavior unchanged with an empty permission map", async () => {
      const onSubmit = await runUnclampedScenario({});

      await waitFor(() => {
        expect(onSubmit, "an empty map must clamp nothing").toHaveBeenCalledWith({
          type: "enterprise",
          code: "C42"
        });
      });
    });
  });
});

/**
 * A representative slice of existing behavior — a linkage-revealed field typed
 * into and submitted — that must be bit-identical whether `fieldPermissions` is
 * absent or an empty map. Returns the submit spy for the caller's payload
 * assertion; the mid-scenario expectations pin the render pipeline.
 */
async function runUnclampedScenario(fieldPermissions: Record<string, FieldPermission> | undefined): Promise<Mock> {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  const schema = stack(
    field("type"),
    field("code", {
      linkage: {
        defaults: { hidden: true },
        rules: [whenEq("type", "enterprise", [{ type: "show" }])]
      }
    }),
    submitButton()
  );

  renderRuntime(<FormRenderer fieldPermissions={fieldPermissions} schema={schema} onSubmit={onSubmit} />);

  expect(
    screen.queryByRole("textbox", { name: "code" }),
    "code starts hidden by its linkage default"
  ).not.toBeInTheDocument();

  await user.type(screen.getByRole("textbox", { name: "type" }), "enterprise");

  const code = await screen.findByRole("textbox", { name: "code" });
  expect(code, "the show rule reveals the field editable").toBeEnabled();

  await user.type(code, "C42");
  await user.click(screen.getByRole("button", { name: "提交" }));

  return onSubmit;
}
