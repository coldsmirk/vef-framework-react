import type { DatetimeField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";

import { MobileDatetimeInput } from "./datetime";

function makeField(overrides: Partial<DatetimeField> = {}): DatetimeField {
  return {
    type: "datetime",
    id: "f1",
    key: "startAt",
    ...overrides
  };
}

describe("MobileDatetimeInput", () => {
  it("renders the placeholder when the value is empty", () => {
    render(
      <MobileDatetimeInput
        domId="d1"
        field={makeField({ placeholder: "选择开始时间" })}
        value=""
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("选择开始时间")).toBeInTheDocument();
  });

  it("shows the seeded datetime on the trigger", () => {
    render(
      <MobileDatetimeInput domId="d1" field={makeField()} value="2026-06-03 14:30:45" onChange={vi.fn()} />
    );

    // The trigger button's accessible name is the field label (its `<label
    // htmlFor>` wins); the formatted value lives in its text content.
    expect(screen.getByRole("button", { name: "日期时间" })).toHaveTextContent("2026-06-03 14:30:45");
  });

  it("round-trips the PC serialized datetime byte-identically on confirm", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const onChange = vi.fn();
    render(
      <MobileDatetimeInput domId="d1" field={makeField()} value="2026-06-03 14:30:45" onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "日期时间" }));
    await user.click(await screen.findByRole("button", { name: "确定" }));

    expect(onChange).toHaveBeenCalledWith("2026-06-03 14:30:45");
  });

  it("commits an empty string when the value is cleared from the trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MobileDatetimeInput domId="d1" field={makeField()} value="2026-06-03 14:30:45" onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "清除" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("offers no clear affordance while empty", () => {
    render(<MobileDatetimeInput domId="d1" field={makeField()} value="" onChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  it("offers no clear affordance when allowClear is false", () => {
    render(
      <MobileDatetimeInput
        domId="d1"
        field={makeField({ allowClear: false })}
        value="2026-06-03 14:30:45"
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  it("renders the field label", () => {
    render(
      <MobileDatetimeInput domId="d1" field={makeField({ label: "开始时间" })} value="" onChange={vi.fn()} />
    );

    expect(screen.getByText("开始时间")).toBeInTheDocument();
  });

  it("renders the trigger disabled when disabled", () => {
    render(<MobileDatetimeInput disabled domId="d1" field={makeField()} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
