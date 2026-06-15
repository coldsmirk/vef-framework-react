import type { FormSchema, LabelPosition, TextfieldField } from "../../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { definePropertyEntry } from "../../../types";
import { SelectEntry } from "./select-entry";

const entry = definePropertyEntry<TextfieldField, string>({
  id: "labelPosition",
  label: "标签位置",
  type: "select",
  placeholder: "默认",
  options: [
    { value: "top", label: "上方" },
    { value: "left", label: "左侧" }
  ],
  read: field => field.labelPosition ?? "",
  write: (field, labelPosition) => { return { ...field, labelPosition: labelPosition as LabelPosition }; }
});

function makeField(labelPosition?: LabelPosition): TextfieldField {
  return {
    id: "Field_1",
    type: "textfield",
    key: "name",
    labelPosition
  };
}

const schema: FormSchema = {
  id: "Form_1",
  version: 2,
  presentations: { pc: { children: [] } }
};

describe("SelectEntry", () => {
  it("renders the selected option's label", () => {
    render(<SelectEntry entry={entry} field={makeField("top")} schema={schema} onChange={vi.fn()} />);

    expect(screen.getByText("上方")).toBeInTheDocument();
  });

  it("shows the placeholder when the value is empty", () => {
    render(<SelectEntry entry={entry} field={makeField()} schema={schema} onChange={vi.fn()} />);

    // An empty-string value must render as "no selection" — otherwise antd
    // treats "" as a real value and never shows the placeholder.
    expect(screen.getByText("默认")).toBeInTheDocument();
  });

  it("forwards the picked option through onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SelectEntry entry={entry} field={makeField()} schema={schema} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("左侧"));

    expect(onChange).toHaveBeenCalledWith("left");
  });
});
