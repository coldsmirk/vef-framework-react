import type { SelectField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { selectFieldDefinition } from "./index";

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

describe("select field", () => {
  it("defines a keyed selection field with an empty static source", () => {
    expect(selectFieldDefinition.config).toMatchObject({
      type: "select",
      keyed: true,
      group: "selection"
    });
    expect(selectFieldDefinition.config.create()).toEqual({
      type: "select",
      label: "下拉选择",
      dataSource: { kind: "static", options: [] }
    });
  });

  it("renders the configured static options in its dropdown", async () => {
    const user = userEvent.setup();
    const { Component } = selectFieldDefinition;

    if (!Component) {
      throw new Error("select field is missing a Component");
    }

    render(<Component domId="field-s" field={makeField()} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "北京" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "上海" })).toBeInTheDocument();
  });

  it("turns the combobox into a searchable input when showSearch is enabled", async () => {
    const user = userEvent.setup();
    const { Component } = selectFieldDefinition;

    if (!Component) {
      throw new Error("select field is missing a Component");
    }

    render(<Component domId="field-s" field={makeField({ showSearch: true })} value="" onChange={vi.fn()} />);

    const combobox = screen.getByRole<HTMLInputElement>("combobox");
    await user.click(combobox);
    await user.type(combobox, "北");

    // With showSearch the inner input is editable and accepts the typed query;
    // the dropdown stays open for filtering.
    expect(combobox).toHaveValue("北");
    expect(combobox).not.toHaveAttribute("readonly");
  });

  it("leaves the combobox read-only when showSearch is off", () => {
    const { Component } = selectFieldDefinition;

    if (!Component) {
      throw new Error("select field is missing a Component");
    }

    render(<Component domId="field-s" field={makeField()} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveAttribute("readonly");
  });

  it("applies the configured control size to the select", () => {
    const { Component } = selectFieldDefinition;

    if (!Component) {
      throw new Error("select field is missing a Component");
    }

    render(<Component domId="field-s" field={makeField({ size: "large" })} value="" onChange={vi.fn()} />);

    // antd encodes the three-step size as a documented `.ant-select-{sm,lg}`
    // wrapper class; `large` maps to `-lg`.

    expect(document.querySelector(".ant-select")).toHaveClass("ant-select-lg");
  });

  it("commits an empty string when the value is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = selectFieldDefinition;

    if (!Component) {
      throw new Error("select field is missing a Component");
    }

    render(<Component domId="field-s" field={makeField({ allowClear: true })} value="bj" onChange={onChange} />);

    // antd's clear affordance is an aria-hidden span (its documented styling
    // hook `.ant-select-clear`) with no accessible handle, so reach for it via
    // document.querySelector.

    const clear = document.querySelector(".ant-select-clear");

    if (!clear) {
      throw new Error("clear affordance not rendered");
    }

    await user.click(clear);

    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
