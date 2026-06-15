import type { RadioField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MobileRadioInput } from "./radio";

function makeField(overrides: Partial<RadioField> = {}): RadioField {
  return {
    id: "Field_r",
    type: "radio",
    key: "r",
    label: "城市",
    dataSource: {
      kind: "static",
      options: [
        { label: "北京", value: "bj" },
        { label: "上海", value: "sh" }
      ]
    },
    ...overrides
  };
}

describe("MobileRadioInput", () => {
  it("renders one radio per option", () => {
    render(<MobileRadioInput domId="field-r" field={makeField()} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "北京" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "上海" })).toBeInTheDocument();
  });

  it("calls onChange with the selected scalar value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MobileRadioInput domId="field-r" field={makeField()} value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "上海" }));

    expect(onChange).toHaveBeenCalledWith("sh");
  });

  it("marks the seeded value as checked", () => {
    render(<MobileRadioInput domId="field-r" field={makeField()} value="bj" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "北京" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "上海" })).not.toBeChecked();
  });

  it("renders disabled without a value in canvas edit mode", () => {
    render(<MobileRadioInput disabled domId="field-r" field={makeField()} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "北京" })).toBeDisabled();
  });
});
