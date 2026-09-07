import type { KeyedFormField, NumberField, SwitchField, TextfieldField } from "../types";

import { describe, expect, it } from "vitest";

import { writeFieldValue } from "./field-write";

function formStub(current: unknown): { form: any; written: unknown[] } {
  const written: unknown[] = [];

  return {
    written,
    form: {
      getFieldValue: () => current,
      setFieldValue: (_name: string, value: unknown) => {
        written.push(value);
      }
    }
  };
}

function write(field: KeyedFormField | undefined, value: unknown, current?: unknown): unknown[] {
  const { form, written } = formStub(current);

  writeFieldValue({
    fieldPermissions: undefined,
    form,
    key: "target",
    prefix: "",
    targetField: field,
    value
  });

  return written;
}

const numberField: NumberField = {
  id: "f1",
  type: "number",
  key: "target"
};
const switchField: SwitchField = {
  id: "f2",
  type: "switch",
  key: "target"
};
const textField: TextfieldField = {
  id: "f3",
  type: "textfield",
  key: "target"
};

describe("writeFieldValue value coercion", () => {
  // The designer's only literal input is a text box, so every literal `assign`
  // / `set_field` value arrives as a string regardless of its target.
  it("parses a numeric literal into a number", () => {
    // A string here silently disables the numeric constraint checks (they gate
    // on `typeof value === "number"`) and the backend then rejects the whole
    // submission with no field-level hint.
    expect(write(numberField, "200")).toEqual([200]);
    expect(write(numberField, " 3.5 ")).toEqual([3.5]);
  });

  it("empties a number field for a blank or non-numeric literal", () => {
    // Starting from a held value, since writing `undefined` over `undefined`
    // is correctly a no-op.
    expect(write(numberField, "", 1)).toEqual([undefined]);
    expect(write(numberField, "abc", 1)).toEqual([undefined]);
  });

  it("parses a boolean literal for a switch", () => {
    // "false" is a truthy string, so an unconverted literal showed the switch
    // as on and submitted the string.
    expect(write(switchField, "false", true)).toEqual([false]);
    expect(write(switchField, "true", false)).toEqual([true]);
  });

  it("leaves a string-like field's value alone", () => {
    // An expression resolving to a number is a legitimate thing to put in a
    // text field; stringifying it here would be a second behaviour change.
    expect(write(textField, "text")).toEqual(["text"]);
    expect(write(textField, 42)).toEqual([42]);
  });

  it("leaves the value alone when the target field is unknown", () => {
    expect(write(undefined, "200")).toEqual(["200"]);
  });

  it("still bails when the coerced value equals what the field holds", () => {
    expect(write(numberField, "200", 200)).toEqual([]);
  });
});
