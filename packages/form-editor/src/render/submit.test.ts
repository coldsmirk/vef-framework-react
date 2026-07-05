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
