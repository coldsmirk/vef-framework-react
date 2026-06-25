import type { FormSchema, NumberField } from "../../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { definePropertyEntry } from "../../../types";
import { NumberEntry } from "./number-entry";

const entry = definePropertyEntry<NumberField, number | undefined>({
  id: "max",
  label: "最大值",
  type: "number",
  read: field => field.max,
  write: (field, max) => { return { ...field, max }; }
});

function makeField(max?: number): NumberField {
  return {
    id: "Field_1",
    type: "number",
    key: "amount",
    max
  };
}

const schema: FormSchema = {
  id: "Form_1",
  version: 2,
  presentations: { pc: { children: [] } }
};

describe("NumberEntry", () => {
  it("renders the entry label and current value", () => {
    render(<NumberEntry entry={entry} field={makeField(10)} schema={schema} onChange={vi.fn()} />);

    expect(screen.getByText("最大值")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
  });

  it("commits typed digits as numbers", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<NumberEntry entry={entry} field={makeField(1)} schema={schema} onChange={onChange} />);

    await user.type(screen.getByDisplayValue("1"), "0");

    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it("commits undefined when the input is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<NumberEntry entry={entry} field={makeField(7)} schema={schema} onChange={onChange} />);

    await user.clear(screen.getByDisplayValue("7"));

    // Explicitly called with `undefined` (one argument), clearing the value.
    expect(onChange.mock.lastCall).toEqual([undefined]);
  });
});
