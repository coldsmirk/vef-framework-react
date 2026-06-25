import type { ReactElement } from "react";

import type { NumberField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { MobileNumber } from "./number";

const baseField: NumberField = {
  id: "Field_n",
  type: "number",
  key: "n",
  label: "数量"
};

/**
 * Mirrors the runtime wiring: committed values flow back into the `value`
 * prop, which the clamp semantics depend on (the reconcile guard compares the
 * draft's commit result against the live committed value).
 */
function ControlledNumber({
  field,
  onCommit
}: {
  field: NumberField;
  onCommit: (next: number | undefined) => void;
}): ReactElement {
  const [value, setValue] = useState<number | undefined>();

  return (
    <MobileNumber
      domId="field-n"
      field={field}
      value={value}
      onChange={next => {
        onCommit(next);
        setValue(next);
      }}
    />
  );
}

describe("MobileNumber", () => {
  it("renders the label and a numeric input", () => {
    render(<MobileNumber domId="field-n" field={baseField} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("spinbutton", { name: "数量" })).toBeInTheDocument();
  });

  it("seeds the input with the current numeric value", () => {
    render(<MobileNumber domId="field-n" field={baseField} value={42} onChange={vi.fn()} />);

    expect(screen.getByRole("spinbutton", { name: "数量" })).toHaveValue(42);
  });

  it("emits a number through onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MobileNumber domId="field-n" field={baseField} value={undefined} onChange={onChange} />);

    await user.type(screen.getByRole("spinbutton", { name: "数量" }), "5");

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("emits undefined when the value is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MobileNumber domId="field-n" field={baseField} value={42} onChange={onChange} />);

    await user.clear(screen.getByRole("spinbutton", { name: "数量" }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("renders the placeholder when no value is set", () => {
    const field: NumberField = { ...baseField, placeholder: "请输入数量" };

    render(<MobileNumber domId="field-n" field={field} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText("请输入数量")).toBeInTheDocument();
  });

  it("renders the helper text", () => {
    const field: NumberField = { ...baseField, helperText: "0 到 99" };

    render(<MobileNumber domId="field-n" field={field} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByText("0 到 99")).toBeInTheDocument();
  });

  it("renders field errors", () => {
    render(<MobileNumber domId="field-n" errors={["此项必填"]} field={baseField} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("此项必填");
  });

  it("disables the input when disabled", () => {
    render(<MobileNumber disabled domId="field-n" field={baseField} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("spinbutton", { name: "数量" })).toBeDisabled();
  });

  it("renders without throwing when value is undefined and disabled", () => {
    render(<MobileNumber disabled domId="field-n" field={baseField} value={undefined} onChange={vi.fn()} />);

    const input = screen.getByRole("spinbutton", { name: "数量" });

    expect(input).toBeDisabled();
    expect(input).toHaveValue(null);
  });

  describe("range clamping", () => {
    it("commits the max when typing exceeds it and keeps the in-progress text until blur", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<ControlledNumber field={{ ...baseField, max: 10 }} onCommit={onCommit} />);

      const input = screen.getByRole("spinbutton", { name: "数量" });

      await user.type(input, "999");

      // The committed value is clamped per keystroke ("9" → 9, "99"/"999" → 10);
      // the displayed draft keeps the typed text while editing continues.
      expect(onCommit).toHaveBeenLastCalledWith(10);
      expect(input).toHaveValue(999);
    });

    it("normalizes the display to the clamped value on blur", async () => {
      const user = userEvent.setup();

      render(<ControlledNumber field={{ ...baseField, max: 10 }} onCommit={vi.fn()} />);

      const input = screen.getByRole("spinbutton", { name: "数量" });

      await user.type(input, "999");
      await user.tab();

      expect(input).toHaveValue(10);
    });

    it("commits the min when the typed value falls below it", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<ControlledNumber field={{ ...baseField, min: 10 }} onCommit={onCommit} />);

      const input = screen.getByRole("spinbutton", { name: "数量" });

      await user.type(input, "5");
      await user.tab();

      expect(onCommit).toHaveBeenLastCalledWith(10);
      expect(input).toHaveValue(10);
    });

    it("commits an in-range typed value unchanged", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <ControlledNumber
          field={{
            ...baseField,
            max: 10,
            min: 0
          }}
          onCommit={onCommit}
        />
      );

      await user.type(screen.getByRole("spinbutton", { name: "数量" }), "7");

      expect(onCommit).toHaveBeenLastCalledWith(7);
    });
  });
});
