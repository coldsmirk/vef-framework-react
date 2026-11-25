import type { MultiSelectField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { multiSelectFieldDefinition } from "./index";

function makeField(overrides: Partial<MultiSelectField> = {}): MultiSelectField {
  return {
    id: "Field_ms",
    type: "multi-select",
    key: "cities",
    label: "城市",
    dataSource: {
      kind: "static",
      options: [
        { label: "北京", value: "bj" },
        { label: "上海", value: "sh" },
        { label: "深圳", value: "sz" }
      ]
    },
    ...overrides
  };
}

describe("multi-select field", () => {
  it("defines a keyed selection field with an empty static source", () => {
    expect(multiSelectFieldDefinition.config).toMatchObject({
      type: "multi-select",
      name: "下拉多选",
      keyed: true,
      group: "selection"
    });
    expect(multiSelectFieldDefinition.config.create()).toEqual({
      type: "multi-select",
      label: "下拉多选",
      dataSource: { kind: "static", options: [] }
    });
  });

  it("adds selected options to the array value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = multiSelectFieldDefinition;

    if (!Component) {
      throw new Error("multi-select field is missing a Component");
    }

    render(<Component domId="field-ms" field={makeField()} value={["bj"]} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("上海"));

    expect(onChange).toHaveBeenLastCalledWith(["bj", "sh"]);
  });

  it("commits an empty array when the value is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = multiSelectFieldDefinition;

    if (!Component) {
      throw new Error("multi-select field is missing a Component");
    }

    render(<Component domId="field-ms" field={makeField({ allowClear: true })} value={["bj", "sh"]} onChange={onChange} />);

    const clear = document.querySelector(".ant-select-clear");

    if (!clear) {
      throw new Error("clear affordance not rendered");
    }

    await user.click(clear);

    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("prevents selecting beyond maxCount", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = multiSelectFieldDefinition;

    if (!Component) {
      throw new Error("multi-select field is missing a Component");
    }

    render(<Component domId="field-ms" field={makeField({ maxCount: 2 })} value={["bj", "sh"]} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    const szLabel = await screen.findByText("深圳");
    const szOption = szLabel.closest(".ant-select-item-option");

    if (!szOption) {
      throw new Error("option item not rendered");
    }

    expect(szOption).toHaveAttribute("aria-disabled", "true");
    await user.click(szOption);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("filters options by label when showSearch is enabled", async () => {
    const user = userEvent.setup();
    const { Component } = multiSelectFieldDefinition;

    if (!Component) {
      throw new Error("multi-select field is missing a Component");
    }

    render(<Component domId="field-ms" field={makeField({ showSearch: true })} value={[]} onChange={vi.fn()} />);

    const combobox = screen.getByRole<HTMLInputElement>("combobox");
    await user.click(combobox);
    await user.type(combobox, "上海");

    expect(await screen.findByText("上海")).toBeInTheDocument();
    expect(screen.queryByText("北京")).not.toBeInTheDocument();
  });

  it("leaves the combobox read-only when showSearch is off", () => {
    const { Component } = multiSelectFieldDefinition;

    if (!Component) {
      throw new Error("multi-select field is missing a Component");
    }

    render(<Component domId="field-ms" field={makeField()} value={[]} onChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveAttribute("readonly");
  });

  it("shows 请选择 as the default placeholder and honors an explicit override", () => {
    const Component = multiSelectFieldDefinition.Component!;
    const { rerender } = render(<Component domId="field-ms" field={makeField()} value={[]} onChange={vi.fn()} />);

    expect(screen.getByText("请选择")).toBeInTheDocument();

    rerender(<Component domId="field-ms" field={makeField({ placeholder: "请选择多个城市" })} value={[]} onChange={vi.fn()} />);

    expect(screen.getByText("请选择多个城市")).toBeInTheDocument();
  });

  it("renders only top-level options, shows descriptions, and blocks disabled options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const Component = multiSelectFieldDefinition.Component!;

    render(
      <Component
        domId="field-ms"
        value={[]}
        field={makeField({
          showSearch: true,
          dataSource: {
            kind: "static",
            options: [
              {
                label: "研发部",
                value: "rd",
                description: "核心研发",
                children: [{ label: "平台组", value: "platform" }]
              },
              {
                label: "归档部",
                value: "legacy",
                disabled: true,
                description: "已停用"
              }
            ]
          }
        })}
        onChange={onChange}
      />
    );

    const combobox = screen.getByRole<HTMLInputElement>("combobox");
    await user.click(combobox);

    expect(await screen.findByText("核心研发")).toBeInTheDocument();
    expect(screen.queryByText("平台组")).not.toBeInTheDocument();

    const disabledItem = screen.getByText("已停用").closest(".ant-select-item-option");
    expect(disabledItem).toHaveAttribute("aria-disabled", "true");
    await user.click(disabledItem!);
    expect(onChange).not.toHaveBeenCalled();

    await user.type(combobox, "核心");
    expect(await screen.findByText("核心研发")).toBeInTheDocument();
    expect(screen.queryByText("已停用")).not.toBeInTheDocument();
  });
});
