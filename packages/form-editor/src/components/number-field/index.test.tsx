import type { NumberField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { numberFieldDefinition } from "./index";

describe("number field", () => {
  it("defines a keyed numeric field with serializable defaults", () => {
    expect(numberFieldDefinition.config).toMatchObject({
      type: "number",
      keyed: true,
      group: "basic-input"
    });
    expect(numberFieldDefinition.config.create()).toEqual({ type: "number", label: "数字" });
  });

  it("renders the label and a numeric input", () => {
    const { Component } = numberFieldDefinition;
    const field: NumberField = {
      id: "Field_n",
      type: "number",
      key: "n",
      label: "数量"
    };

    if (!Component) {
      throw new Error("number field is missing a Component");
    }

    render(<Component domId="field-n" field={field} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("spinbutton", { name: "数量" })).toBeInTheDocument();
  });

  it("commits undefined when the value is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = numberFieldDefinition;
    const field: NumberField = {
      id: "Field_n",
      type: "number",
      key: "n",
      label: "数量"
    };

    if (!Component) {
      throw new Error("number field is missing a Component");
    }

    render(<Component domId="field-n" field={field} value={42} onChange={onChange} />);

    await user.clear(screen.getByRole("spinbutton", { name: "数量" }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("rounds the committed value to the configured precision", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = numberFieldDefinition;
    const field: NumberField = {
      id: "Field_n",
      type: "number",
      key: "n",
      label: "数量",
      precision: 2
    };

    if (!Component) {
      throw new Error("number field is missing a Component");
    }

    render(
      <>
        <Component domId="field-n" field={field} value={undefined} onChange={onChange} />
        <button type="button">外部</button>
      </>
    );

    await user.type(screen.getByRole("spinbutton", { name: "数量" }), "3.456");
    // Blur to flush antd's precision reformat, which only applies on commit.
    await user.click(screen.getByRole("button", { name: "外部" }));

    expect(onChange).toHaveBeenLastCalledWith(3.46);
  });

  it("renders the prefix and suffix affixes", () => {
    const { Component } = numberFieldDefinition;
    const field: NumberField = {
      id: "Field_n",
      type: "number",
      key: "n",
      label: "金额",
      prefix: "¥",
      suffix: "元"
    };

    if (!Component) {
      throw new Error("number field is missing a Component");
    }

    render(<Component domId="field-n" field={field} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByText("¥")).toBeInTheDocument();
    expect(screen.getByText("元")).toBeInTheDocument();
  });
});
