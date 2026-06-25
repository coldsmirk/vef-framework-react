import type { PropertyEntry, RadioField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { radioFieldDefinition } from "./index";

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

function findEntry(id: string): PropertyEntry {
  const entry = radioFieldDefinition.properties.flatMap(group => group.entries).find(candidate => candidate.id === id);

  if (!entry) {
    throw new Error(`radio field is missing the "${id}" property entry`);
  }

  return entry;
}

function renderField(overrides: Partial<RadioField> = {}) {
  const { Component } = radioFieldDefinition;

  if (!Component) {
    throw new Error("radio field is missing a Component");
  }

  return render(<Component domId="field-r" field={makeField(overrides)} value="" onChange={vi.fn()} />);
}

describe("radio field", () => {
  it("defines a keyed selection field with an empty static source", () => {
    expect(radioFieldDefinition.config).toMatchObject({
      type: "radio",
      keyed: true,
      group: "selection"
    });
    expect(radioFieldDefinition.config.create()).toEqual({
      type: "radio",
      label: "单选",
      dataSource: { kind: "static", options: [] }
    });
  });

  it("emits the chosen option value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = radioFieldDefinition;

    if (!Component) {
      throw new Error("radio field is missing a Component");
    }

    render(<Component domId="field-r" field={makeField()} value="" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "上海" }));

    expect(onChange).toHaveBeenCalledWith("sh");
  });

  it("renders the button variant when optionType is button", () => {
    renderField({ optionType: "button" });

    expect(screen.getByRole("radio", { name: "上海" })).toHaveClass("ant-radio-button-input");
  });

  it("renders the default dot variant when optionType is unset", () => {
    renderField();

    const radio = screen.getByRole("radio", { name: "上海" });

    expect(radio).toHaveClass("ant-radio-input");
    expect(radio).not.toHaveClass("ant-radio-button-input");
  });

  it("applies the buttonStyle fill to the button group", () => {
    renderField({ buttonStyle: "solid", optionType: "button" });

    expect(screen.getByRole("radiogroup")).toHaveClass("ant-radio-group-solid");
  });

  it("hides the buttonStyle entry unless optionType is button", () => {
    const buttonStyle = findEntry("buttonStyle");

    expect(buttonStyle.visible?.(makeField())).toBe(false);
    expect(buttonStyle.visible?.(makeField({ optionType: "default" }))).toBe(false);
    expect(buttonStyle.visible?.(makeField({ optionType: "button" }))).toBe(true);
  });

  it("lays the options out horizontally when direction is horizontal", () => {
    renderField({ direction: "horizontal" });

    expect(screen.getByRole("radiogroup")).not.toHaveClass("ant-radio-group-vertical");
  });

  it("lays the options out vertically when direction is vertical", () => {
    renderField({ direction: "vertical" });

    expect(screen.getByRole("radiogroup")).toHaveClass("ant-radio-group-vertical");
  });

  it("shows an empty hint instead of a blank void when the source has no options", () => {
    renderField({ dataSource: { kind: "static", options: [] } });

    expect(screen.getByText("暂无选项")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});
