import type { SwitchField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MobileSwitch } from "./switch";

const baseField: SwitchField = {
  id: "Field_s",
  type: "switch",
  key: "s",
  label: "启用"
};

describe("MobileSwitch", () => {
  it("renders the label and a switch", () => {
    render(<MobileSwitch domId="field-s" field={baseField} value={false} onChange={vi.fn()} />);

    expect(screen.getByText("启用")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("reflects an off value as unchecked", () => {
    render(<MobileSwitch domId="field-s" field={baseField} value={false} onChange={vi.fn()} />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("reflects an on value as checked", () => {
    render(<MobileSwitch value domId="field-s" field={baseField} onChange={vi.fn()} />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("emits true when toggled on", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MobileSwitch domId="field-s" field={baseField} value={false} onChange={onChange} />);

    await user.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("emits false when toggled off", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MobileSwitch value domId="field-s" field={baseField} onChange={onChange} />);

    await user.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("renders the helper text", () => {
    const field: SwitchField = { ...baseField, helperText: "默认关闭" };

    render(<MobileSwitch domId="field-s" field={field} value={false} onChange={vi.fn()} />);

    expect(screen.getByText("默认关闭")).toBeInTheDocument();
  });

  it("renders field errors", () => {
    render(<MobileSwitch domId="field-s" errors={["此项必填"]} field={baseField} value={false} onChange={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("此项必填");
  });

  it("does not emit when disabled and clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MobileSwitch disabled domId="field-s" field={baseField} value={false} onChange={onChange} />);

    const control = screen.getByRole("switch");

    expect(control).toHaveAttribute("aria-disabled", "true");

    await user.click(control);

    expect(onChange).not.toHaveBeenCalled();
  });
});
