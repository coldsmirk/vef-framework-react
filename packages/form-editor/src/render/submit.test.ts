import type { Block, SectionNode, SubformNode, TextfieldField } from "../types";

import {
  blankSubformRow,
  buildRuntimeFormId,
  collectSubmitErrors,
  filterSubmitValues,
  validateRuntimeField
} from "./submit";

function field(key: string, overrides: Partial<TextfieldField> = {}): TextfieldField {
  return {
    id: `Field_${key}`,
    type: "textfield",
    key,
    label: key,
    ...overrides
  };
}

function hiddenWhen(sourceKey: string, value: string): SectionNode["linkage"] {
  return {
    rules: [
      {
        id: `Rule_${sourceKey}`,
        trigger: {
          kind: "condition",
          condition: {
            kind: "leaf",
            sourceKey,
            operator: "eq",
            value
          }
        },
        actions: [{ type: "hide" }]
      }
    ]
  };
}

function section(id: string, children: Block[], overrides: Partial<SectionNode> = {}): SectionNode {
  return {
    id,
    type: "section",
    variant: "card",
    children,
    ...overrides
  };
}

function keyedSubform(key: string): SubformNode {
  return {
    id: "Sub_1",
    type: "subform",
    variant: "stack",
    key,
    template: [field("amount")]
  };
}

describe("filterSubmitValues", () => {
  it("keeps visible field values and drops a directly hidden field", () => {
    const blocks: Block[] = [
      field("kept"),
      field("dropped", { linkage: { defaults: { hidden: true } } })
    ];

    const values = filterSubmitValues({
      blocks,
      evaluators: undefined,
      evaluationContext: undefined,
      values: { kept: "a", dropped: "b" }
    });

    expect(values).toEqual({ kept: "a" });
  });

  it("drops a field inside a linkage-hidden ancestor section", () => {
    const blocks: Block[] = [
      field("mode"),
      section("Sec_1", [field("inner")], { linkage: hiddenWhen("mode", "off") })
    ];

    const values = filterSubmitValues({
      blocks,
      evaluators: undefined,
      evaluationContext: undefined,
      values: { mode: "off", inner: "secret" }
    });

    expect(values).toEqual({ mode: "off" });
  });

  it("keeps a field when the ancestor section is visible", () => {
    const blocks: Block[] = [
      field("mode"),
      section("Sec_1", [field("inner")], { linkage: hiddenWhen("mode", "off") })
    ];

    const values = filterSubmitValues({
      blocks,
      evaluators: undefined,
      evaluationContext: undefined,
      values: { mode: "on", inner: "kept" }
    });

    expect(values).toEqual({ mode: "on", inner: "kept" });
  });

  it("strips hidden-ancestor descendants per subform row", () => {
    const subform: SubformNode = {
      id: "Sub_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      template: [
        field("category"),
        section("Sec_row", [field("note")], { linkage: hiddenWhen("category", "food") })
      ]
    };

    const values = filterSubmitValues({
      blocks: [subform],
      evaluators: undefined,
      evaluationContext: undefined,
      values: {
        lines: [
          { category: "food", note: "stripped" },
          { category: "other", note: "kept" }
        ]
      }
    });

    expect(values).toEqual({
      lines: [{ category: "food" }, { category: "other", note: "kept" }]
    });
  });

  it("drops a hidden subform whole", () => {
    const subform: SubformNode = {
      id: "Sub_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      linkage: { defaults: { hidden: true } },
      template: [field("amount")]
    };

    const values = filterSubmitValues({
      blocks: [subform],
      evaluators: undefined,
      evaluationContext: undefined,
      values: { lines: [{ amount: "1" }] }
    });

    expect(values).toEqual({});
  });

  describe("field permissions", () => {
    it("drops a visible-clamped (read-only) field from the payload", () => {
      const values = filterSubmitValues({
        blocks: [field("kept"), field("readonly")],
        evaluators: undefined,
        evaluationContext: undefined,
        fieldPermissions: { readonly: "visible" },
        values: { kept: "a", readonly: "server" }
      });

      expect(values, "a read-only value is display-only and must not submit").toEqual({ kept: "a" });
    });

    it("drops a hidden-clamped field from the payload", () => {
      const values = filterSubmitValues({
        blocks: [field("kept"), field("gone")],
        evaluators: undefined,
        evaluationContext: undefined,
        fieldPermissions: { gone: "hidden" },
        values: { kept: "a", gone: "b" }
      });

      expect(values, "a hidden-clamped value must not submit").toEqual({ kept: "a" });
    });

    it("keeps editable-clamped, required-clamped, and unlisted keys", () => {
      const values = filterSubmitValues({
        blocks: [field("open"), field("must"), field("free")],
        evaluators: undefined,
        evaluationContext: undefined,
        fieldPermissions: { open: "editable", must: "required" },
        values: {
          open: "1",
          must: "2",
          free: "3"
        }
      });

      expect(values, "writable and unclamped keys all submit").toEqual({
        open: "1",
        must: "2",
        free: "3"
      });
    });

    it("drops a non-writable subform whole", () => {
      const values = filterSubmitValues({
        blocks: [keyedSubform("lines")],
        evaluators: undefined,
        evaluationContext: undefined,
        fieldPermissions: { lines: "visible" },
        values: { lines: [{ amount: "1" }] }
      });

      expect(values, "a read-only subform's rows must not submit").toEqual({});
    });

    it("keeps a required-clamped subform's rows", () => {
      const values = filterSubmitValues({
        blocks: [keyedSubform("lines")],
        evaluators: undefined,
        evaluationContext: undefined,
        fieldPermissions: { lines: "required" },
        values: { lines: [{ amount: "1" }] }
      });

      expect(values, "a required clamp keeps the subform writable").toEqual({ lines: [{ amount: "1" }] });
    });

    it("does not clamp a template field whose key matches a root permission", () => {
      const values = filterSubmitValues({
        blocks: [keyedSubform("lines")],
        evaluators: undefined,
        evaluationContext: undefined,
        fieldPermissions: { amount: "hidden" },
        values: { lines: [{ amount: "1" }] }
      });

      // Top-level permissions address root-scope keys only; the template's
      // `amount` shares the name but lives in the row scope.
      expect(values, "the clamp must stop at the subform boundary").toEqual({ lines: [{ amount: "1" }] });
    });
  });
});

describe("collectSubmitErrors", () => {
  it("reports a required empty field by its name", () => {
    const errors = collectSubmitErrors({
      blocks: [field("name", { validate: { required: true } })],
      disabled: false,
      evaluators: undefined,
      evaluationContext: undefined,
      namePrefix: "",
      values: { name: "" }
    });

    expect(errors).toEqual({ name: "此项为必填" });
  });

  it("reports a constraint violation on a present value", () => {
    const errors = collectSubmitErrors({
      blocks: [field("name", { validate: { minLength: 3 } })],
      disabled: false,
      evaluators: undefined,
      evaluationContext: undefined,
      namePrefix: "",
      values: { name: "ab" }
    });

    expect(errors).toEqual({ name: "最少 3 个字符" });
  });

  it("exempts a required field hidden by an ancestor section", () => {
    const errors = collectSubmitErrors({
      blocks: [
        field("mode"),
        section("Sec_1", [field("inner", { validate: { required: true } })], { linkage: hiddenWhen("mode", "off") })
      ],
      disabled: false,
      evaluators: undefined,
      evaluationContext: undefined,
      namePrefix: "",
      values: { mode: "off", inner: "" }
    });

    expect(errors).toEqual({});
  });

  it("exempts a required field inside a disabled ancestor section", () => {
    const disableSection: SectionNode["linkage"] = {
      rules: [
        {
          id: "Rule_disable",
          trigger: {
            kind: "condition",
            condition: {
              kind: "leaf",
              sourceKey: "mode",
              operator: "eq",
              value: "locked"
            }
          },
          actions: [{ type: "disable" }]
        }
      ]
    };

    const errors = collectSubmitErrors({
      blocks: [
        field("mode"),
        section("Sec_1", [field("inner", { validate: { required: true } })], { linkage: disableSection })
      ],
      disabled: false,
      evaluators: undefined,
      evaluationContext: undefined,
      namePrefix: "",
      values: { mode: "locked", inner: "" }
    });

    expect(errors).toEqual({});
  });

  it("reports subform row failures under prefixed names", () => {
    const subform: SubformNode = {
      id: "Sub_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      template: [field("amount", { validate: { required: true } })]
    };

    const errors = collectSubmitErrors({
      blocks: [subform],
      disabled: false,
      evaluators: undefined,
      evaluationContext: undefined,
      namePrefix: "",
      values: { lines: [{ amount: "" }, { amount: "5" }] }
    });

    expect(errors).toEqual({ "lines[0].amount": "此项为必填" });
  });

  it("exempts every field when the form is disabled", () => {
    const errors = collectSubmitErrors({
      blocks: [field("name", { validate: { required: true } })],
      disabled: true,
      evaluators: undefined,
      evaluationContext: undefined,
      namePrefix: "",
      values: { name: "" }
    });

    expect(errors).toEqual({});
  });

  it("exempts a hidden subform's rows entirely", () => {
    const subform: SubformNode = {
      id: "Sub_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      linkage: { defaults: { hidden: true } },
      template: [field("amount", { validate: { required: true } })]
    };

    const errors = collectSubmitErrors({
      blocks: [subform],
      disabled: false,
      evaluators: undefined,
      evaluationContext: undefined,
      namePrefix: "",
      values: { lines: [{ amount: "" }] }
    });

    expect(errors).toEqual({});
  });

  describe("field permissions", () => {
    it("fails an empty required-clamped field without a static rule", () => {
      const errors = collectSubmitErrors({
        blocks: [field("code")],
        disabled: false,
        evaluators: undefined,
        evaluationContext: undefined,
        fieldPermissions: { code: "required" },
        namePrefix: "",
        values: { code: "" }
      });

      expect(errors, "a required clamp alone must enforce the empty check").toEqual({ code: "此项为必填" });
    });

    it("exempts a statically-required field clamped visible", () => {
      const errors = collectSubmitErrors({
        blocks: [field("locked", { validate: { required: true } })],
        disabled: false,
        evaluators: undefined,
        evaluationContext: undefined,
        fieldPermissions: { locked: "visible" },
        namePrefix: "",
        values: { locked: "" }
      });

      expect(errors, "a read-only field must not hold the form hostage").toEqual({});
    });

    it("exempts a statically-required field clamped hidden", () => {
      const errors = collectSubmitErrors({
        blocks: [field("locked", { validate: { required: true } })],
        disabled: false,
        evaluators: undefined,
        evaluationContext: undefined,
        fieldPermissions: { locked: "hidden" },
        namePrefix: "",
        values: { locked: "" }
      });

      expect(errors, "a value that never submits must not block submission").toEqual({});
    });

    it("exempts a non-writable subform's rows entirely", () => {
      const subform: SubformNode = {
        id: "Sub_lines",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [field("amount", { validate: { required: true } })]
      };

      const errors = collectSubmitErrors({
        blocks: [subform],
        disabled: false,
        evaluators: undefined,
        evaluationContext: undefined,
        fieldPermissions: { lines: "visible" },
        namePrefix: "",
        values: { lines: [{ amount: "" }] }
      });

      expect(errors, "a read-only subform's rows are wholly exempt").toEqual({});
    });

    it("does not require a template field whose key matches a root required clamp", () => {
      const subform: SubformNode = {
        id: "Sub_lines",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [field("amount")]
      };

      const errors = collectSubmitErrors({
        blocks: [subform],
        disabled: false,
        evaluators: undefined,
        evaluationContext: undefined,
        fieldPermissions: { amount: "required" },
        namePrefix: "",
        values: { lines: [{ amount: "" }] }
      });

      // The root clamp addresses a root-scope `amount`; the template field of
      // the same name lives in the row scope and stays optional.
      expect(errors, "the clamp must stop at the subform boundary").toEqual({});
    });
  });
});

describe("validateRuntimeField", () => {
  it("skips validation when the inherited scope is disabled", () => {
    const error = validateRuntimeField({
      disabled: true,
      evaluators: undefined,
      evaluationContext: undefined,
      field: field("name", { validate: { required: true } }),
      namePrefix: "",
      value: "",
      values: { name: "" }
    });

    expect(error).toBeUndefined();
  });

  it("validates a required field against its own row scope", () => {
    const error = validateRuntimeField({
      disabled: false,
      evaluators: undefined,
      evaluationContext: undefined,
      field: field("amount", { validate: { required: true } }),
      namePrefix: "lines[0].",
      value: "",
      values: { lines: [{ amount: "" }] }
    });

    expect(error).toBe("此项为必填");
  });

  it("skips a statically-required field clamped non-writable", () => {
    const error = validateRuntimeField({
      disabled: false,
      evaluators: undefined,
      evaluationContext: undefined,
      field: field("locked", { validate: { required: true } }),
      fieldPermissions: { locked: "visible" },
      namePrefix: "",
      value: "",
      values: { locked: "" }
    });

    expect(error, "\"rendered read-only\" and \"skips validation\" must agree").toBeUndefined();
  });

  it("requires an empty value under a required clamp without a static rule", () => {
    const error = validateRuntimeField({
      disabled: false,
      evaluators: undefined,
      evaluationContext: undefined,
      field: field("code"),
      fieldPermissions: { code: "required" },
      namePrefix: "",
      value: "",
      values: { code: "" }
    });

    expect(error, "the required clamp alone must enforce the empty check").toBe("此项为必填");
  });
});

describe("blankSubformRow", () => {
  it("seeds template fields with type-appropriate defaults", () => {
    const subform: SubformNode = {
      id: "Sub_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      template: [
        field("name"),
        {
          id: "Field_qty",
          type: "number",
          key: "qty",
          label: "qty"
        }
      ]
    };

    expect(blankSubformRow(subform)).toEqual({ name: "", qty: undefined });
  });
});

describe("buildRuntimeFormId", () => {
  it("signs keyed bindings but not layout containers", () => {
    const plain = buildRuntimeFormId({ id: "F", children: [field("a")] });
    const sectioned = buildRuntimeFormId({
      id: "F",
      children: [section("Sec_1", [field("a")])]
    });

    // Wrapping the same binding in a pure layout section must not rebuild.
    expect(sectioned).toBe(plain);
    expect(sectioned).toContain("Field_a:a");
  });

  it("changes when a subform key changes", () => {
    const before = buildRuntimeFormId({ id: "F", children: [keyedSubform("lines")] });
    const after = buildRuntimeFormId({ id: "F", children: [keyedSubform("items")] });

    expect(before).not.toBe(after);
  });
});
