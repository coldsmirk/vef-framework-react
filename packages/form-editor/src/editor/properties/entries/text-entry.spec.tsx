import type { FormSchema, TextfieldField } from "../../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { definePropertyEntry } from "../../../types";
import { TextEntry } from "./text-entry";

const entry = definePropertyEntry<TextfieldField, string | undefined>({
  id: "label",
  label: "标签",
  type: "text",
  description: "字段标题",
  read: field => field.label,
  write: (field, label) => { return { ...field, label }; }
});

function makeField(label?: string): TextfieldField {
  return {
    id: "Field_1",
    type: "textfield",
    key: "name",
    label
  };
}

const schema: FormSchema = {
  id: "Form_1",
  version: 2,
  presentations: { pc: { children: [] } }
};

describe("TextEntry", () => {
  it("renders the entry label, value, and description", () => {
    render(<TextEntry entry={entry} field={makeField("姓名")} schema={schema} onChange={vi.fn()} />);

    expect(screen.getByText("标签")).toBeInTheDocument();
    expect(screen.getByDisplayValue("姓名")).toBeInTheDocument();
    expect(screen.getByText("字段标题")).toBeInTheDocument();
  });

  it("renders an unset value as an empty input", () => {
    render(<TextEntry entry={entry} field={makeField()} schema={schema} onChange={vi.fn()} />);

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("forwards typed text through onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TextEntry entry={entry} field={makeField("姓")} schema={schema} onChange={onChange} />);

    await user.type(screen.getByDisplayValue("姓"), "名");

    expect(onChange).toHaveBeenLastCalledWith("姓名");
  });
});
