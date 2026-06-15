import type { CheckboxGroupField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MobileCheckboxGroupInput } from "./checkbox-group";

function makeField(overrides: Partial<CheckboxGroupField> = {}): CheckboxGroupField {
  return {
    id: "Field_c",
    type: "checkbox-group",
    key: "c",
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

describe("MobileCheckboxGroupInput", () => {
  it("renders one checkbox per option", () => {
    render(<MobileCheckboxGroupInput domId="field-c" field={makeField()} value={[]} onChange={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "北京" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "上海" })).toBeInTheDocument();
  });

  it("adds the checked value to the selection array", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MobileCheckboxGroupInput domId="field-c" field={makeField()} value={[]} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: "上海" }));

    expect(onChange).toHaveBeenCalledWith(["sh"]);
  });

  it("appends to an existing selection array", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MobileCheckboxGroupInput domId="field-c" field={makeField()} value={["bj"]} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: "上海" }));

    expect(onChange).toHaveBeenCalledWith(["bj", "sh"]);
  });

  it("marks seeded values as checked", () => {
    render(<MobileCheckboxGroupInput domId="field-c" field={makeField()} value={["sh"]} onChange={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "上海" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "北京" })).not.toBeChecked();
  });

  it("renders disabled with an empty selection in canvas edit mode", () => {
    render(
      <MobileCheckboxGroupInput
        disabled
        domId="field-c"
        field={makeField({ dataSource: { kind: "static", options: [] } })}
        value={[]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("城市")).toBeInTheDocument();
  });

  it("lays the options in a row when direction is horizontal", () => {
    render(<MobileCheckboxGroupInput domId="field-c" field={makeField({ direction: "horizontal" })} value={[]} onChange={vi.fn()} />);

    // The flex group wrapper carries the layout style but exposes no accessible
    // handle; reach it through the option label's parent — the same node-access
    // exemption the canvas spec uses for unlabeled structural elements.
    // eslint-disable-next-line testing-library/no-node-access -- structural flex wrapper, no accessible handle
    const group = screen.getByRole("checkbox", { name: "上海" }).closest("label.adm-checkbox")?.parentElement;
    expect(group).toHaveStyle({ flexDirection: "row" });
  });

  it("stacks the options in a column by default", () => {
    render(<MobileCheckboxGroupInput domId="field-c" field={makeField()} value={[]} onChange={vi.fn()} />);

    // eslint-disable-next-line testing-library/no-node-access -- structural flex wrapper, no accessible handle
    const group = screen.getByRole("checkbox", { name: "上海" }).closest("label.adm-checkbox")?.parentElement;
    expect(group).toHaveStyle({ flexDirection: "column" });
  });
});
