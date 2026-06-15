import type { DateRangeField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";

import { MobileDateRangeInput } from "./daterange";

function makeField(overrides: Partial<DateRangeField> = {}): DateRangeField {
  return {
    type: "daterange",
    id: "f1",
    key: "period",
    ...overrides
  };
}

describe("MobileDateRangeInput", () => {
  it("renders the placeholder when the range is empty", () => {
    render(<MobileDateRangeInput domId="d1" field={makeField()} value={[]} onChange={vi.fn()} />);

    expect(screen.getByText("请选择日期区间")).toBeInTheDocument();
  });

  it("shows both seeded endpoints on the trigger", () => {
    render(
      <MobileDateRangeInput domId="d1" field={makeField()} value={["2026-06-01", "2026-06-03"]} onChange={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "日期区间" })).toHaveTextContent("2026-06-01 至 2026-06-03");
  });

  it("round-trips the PC serialized range byte-identically on confirm", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const onChange = vi.fn();
    render(
      <MobileDateRangeInput domId="d1" field={makeField()} value={["2026-06-01", "2026-06-03"]} onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "日期区间" }));
    await user.click(await screen.findByRole("button", { name: "确认" }));

    expect(onChange).toHaveBeenCalledWith(["2026-06-01", "2026-06-03"]);
  });

  it("commits an empty array when the range is cleared from the trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MobileDateRangeInput domId="d1" field={makeField()} value={["2026-06-01", "2026-06-03"]} onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "清除" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("offers no clear affordance while empty", () => {
    render(<MobileDateRangeInput domId="d1" field={makeField()} value={[]} onChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  it("offers no clear affordance when allowClear is false", () => {
    render(
      <MobileDateRangeInput
        domId="d1"
        field={makeField({ allowClear: false })}
        value={["2026-06-01", "2026-06-03"]}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  it("commits an empty array when the range is cleared on confirm", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const onChange = vi.fn();
    render(<MobileDateRangeInput domId="d1" field={makeField()} value={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("button", { name: "确认" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("renders the field label", () => {
    render(<MobileDateRangeInput domId="d1" field={makeField({ label: "起止日期" })} value={[]} onChange={vi.fn()} />);

    expect(screen.getByText("起止日期")).toBeInTheDocument();
  });

  it("renders the trigger disabled when disabled", () => {
    render(<MobileDateRangeInput disabled domId="d1" field={makeField()} value={[]} onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
