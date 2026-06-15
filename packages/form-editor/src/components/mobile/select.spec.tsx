import type { SelectField } from "../../types";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";

import { MobileSelectInput } from "./select";

// antd-mobile's `Popup` drives `pointer-events` through a `@react-spring`
// animation (`unset` only once the open transition finishes). jsdom never runs
// that animation to completion, so the confirm button reads `pointer-events:
// none` and `userEvent`'s default guard would reject the tap. Disabling the
// guard still fires a real click — it only skips the CSS assertion the animation
// can't satisfy under jsdom.
function setupUser(): ReturnType<typeof userEvent.setup> {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

function makeField(overrides: Partial<SelectField> = {}): SelectField {
  return {
    id: "Field_s",
    type: "select",
    key: "s",
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

describe("MobileSelectInput", () => {
  it("shows the placeholder when no value is selected", () => {
    render(
      <MobileSelectInput
        domId="field-s"
        field={makeField({ placeholder: "请选择城市" })}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("请选择城市")).toBeInTheDocument();
  });

  it("shows the label of the seeded value", () => {
    render(
      <MobileSelectInput domId="field-s" field={makeField()} value="sh" onChange={vi.fn()} />
    );

    expect(screen.getByText("上海")).toBeInTheDocument();
  });

  it("opens the picker when the trigger is tapped", async () => {
    const user = setupUser();

    render(
      <MobileSelectInput domId="field-s" field={makeField()} value={undefined} onChange={vi.fn()} />
    );

    await user.click(screen.getByRole("button", { name: "城市" }));

    expect(await screen.findByRole("button", { name: "确定" })).toBeInTheDocument();
  });

  it("commits the scalar option value on confirm", async () => {
    const user = setupUser();
    const onChange = vi.fn();

    render(
      <MobileSelectInput domId="field-s" field={makeField()} value={undefined} onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "城市" }));
    await user.click(await screen.findByRole("button", { name: "确定" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("bj"));
  });

  it("commits an empty string when there are no options to confirm", async () => {
    const user = setupUser();
    const onChange = vi.fn();

    render(
      <MobileSelectInput
        domId="field-s"
        field={makeField({ dataSource: { kind: "static", options: [] } })}
        value={undefined}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "城市" }));
    await user.click(await screen.findByRole("button", { name: "确定" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(""));
  });

  it("renders disabled without a value in canvas edit mode", () => {
    render(
      <MobileSelectInput disabled domId="field-s" field={makeField()} value={undefined} onChange={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "城市" })).toBeDisabled();
  });

  it("commits an empty string when an allowClear field is cleared from the trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MobileSelectInput domId="field-s" field={makeField({ allowClear: true })} value="sh" onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "清除" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("offers no clear affordance unless the field opts into allowClear", () => {
    // Mirrors the PC select: clearability is the field's `allowClear` choice.
    render(<MobileSelectInput domId="field-s" field={makeField()} value="sh" onChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  it("offers no clear affordance while disabled", () => {
    render(
      <MobileSelectInput
        disabled
        domId="field-s"
        field={makeField({ allowClear: true })}
        value="sh"
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });
});
