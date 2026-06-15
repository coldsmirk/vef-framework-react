import type { DateField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";

import { MobileDateInput } from "./date";

function makeField(overrides: Partial<DateField> = {}): DateField {
  return {
    type: "date",
    id: "f1",
    key: "birthday",
    ...overrides
  };
}

describe("MobileDateInput", () => {
  it("renders the placeholder when the value is empty", () => {
    render(
      <MobileDateInput domId="d1" field={makeField({ placeholder: "选个生日" })} value="" onChange={vi.fn()} />
    );

    expect(screen.getByText("选个生日")).toBeInTheDocument();
  });

  it("shows the seeded date on the trigger", () => {
    render(<MobileDateInput domId="d1" field={makeField()} value="2026-06-03" onChange={vi.fn()} />);

    // The trigger button's accessible name is the field label (its `<label
    // htmlFor>` wins); the formatted value lives in its text content.
    expect(screen.getByRole("button", { name: "日期" })).toHaveTextContent("2026-06-03");
  });

  it("round-trips the PC serialized string byte-identically on confirm", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const onChange = vi.fn();
    render(<MobileDateInput domId="d1" field={makeField()} value="2026-06-03" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "日期" }));
    await user.click(await screen.findByRole("button", { name: "确定" }));

    expect(onChange).toHaveBeenCalledWith("2026-06-03");
  });

  it("renders the field label", () => {
    render(<MobileDateInput domId="d1" field={makeField({ label: "出生日期" })} value="" onChange={vi.fn()} />);

    expect(screen.getByText("出生日期")).toBeInTheDocument();
  });

  it("renders the trigger disabled when disabled", () => {
    render(<MobileDateInput disabled domId="d1" field={makeField()} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("commits an empty string when the value is cleared from the trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MobileDateInput domId="d1" field={makeField()} value="2026-06-03" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "清除" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("offers no clear affordance while empty", () => {
    render(<MobileDateInput domId="d1" field={makeField()} value="" onChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  it("offers no clear affordance while disabled", () => {
    render(<MobileDateInput disabled domId="d1" field={makeField()} value="2026-06-03" onChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  it("offers no clear affordance when allowClear is false", () => {
    render(
      <MobileDateInput domId="d1" field={makeField({ allowClear: false })} value="2026-06-03" onChange={vi.fn()} />
    );

    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  it("renders an unparseable stored value as the placeholder without crashing", () => {
    render(<MobileDateInput domId="d1" field={makeField()} value="not-a-date" onChange={vi.fn()} />);

    expect(screen.getByText("请选择日期")).toBeInTheDocument();
  });
});
