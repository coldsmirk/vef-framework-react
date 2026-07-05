import type { FormSchema, TextfieldField } from "../../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { definePropertyEntry } from "../../../types";
import { CheckboxEntry } from "./checkbox-entry";

const entry = definePropertyEntry<TextfieldField, boolean>({
  id: "required",
  label: "必填",
  type: "checkbox",
  read: field => field.validate?.required === true,
  write: (field, required) => { return { ...field, validate: { ...field.validate, required } }; }
});

function makeField(required?: boolean): TextfieldField {
  return {
    id: "Field_1",
    type: "textfield",
    key: "name",
    ...required !== undefined && { validate: { required } }
  };
}

const schema: FormSchema = {
  id: "Form_1",
  version: 2,
  presentations: { pc: { children: [] } }
};

describe("CheckboxEntry", () => {
  it("reflects the read value as the checked state", () => {
    render(<CheckboxEntry entry={entry} field={makeField(true)} schema={schema} onChange={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "必填" })).toBeChecked();
  });

  it("treats an unset value as unchecked", () => {
    render(<CheckboxEntry entry={entry} field={makeField()} schema={schema} onChange={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "必填" })).not.toBeChecked();
  });

  it("forwards the toggled state through onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CheckboxEntry entry={entry} field={makeField(false)} schema={schema} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: "必填" }));

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
