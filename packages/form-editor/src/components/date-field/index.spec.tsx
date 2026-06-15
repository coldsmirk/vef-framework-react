import type { DateField, DateRangeField, DatetimeField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { dateFieldDefinition, dateRangeFieldDefinition, datetimeFieldDefinition } from "./index";

function getClearAffordance(): Element {
  // antd's clear affordance is an aria-hidden span (its documented styling
  // hook `.ant-picker-clear`) with no accessible handle, so reach for it via
  // document.querySelector.
  // eslint-disable-next-line testing-library/no-node-access
  const clear = document.querySelector(".ant-picker-clear");

  if (!clear) {
    throw new Error("clear affordance not rendered");
  }

  return clear;
}

describe("date fields", () => {
  it("defines keyed date / datetime / daterange fields", () => {
    expect(dateFieldDefinition.config).toMatchObject({
      type: "date",
      keyed: true,
      group: "date-file"
    });
    expect(datetimeFieldDefinition.config).toMatchObject({
      type: "datetime",
      keyed: true,
      group: "date-file"
    });
    expect(dateRangeFieldDefinition.config).toMatchObject({
      type: "daterange",
      keyed: true,
      group: "date-file"
    });
  });

  it("displays a stored date string in the picker", () => {
    const { Component } = dateFieldDefinition;

    if (!Component) {
      throw new Error("date field is missing a Component");
    }

    const field: DateField = {
      id: "D",
      type: "date",
      key: "d",
      label: "日期"
    };

    render(<Component domId="field-d" field={field} value="2025-01-15" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox")).toHaveValue("2025-01-15");
  });

  it("emits the formatted string when a date is typed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = dateFieldDefinition;

    if (!Component) {
      throw new Error("date field is missing a Component");
    }

    const field: DateField = {
      id: "D",
      type: "date",
      key: "d",
      label: "日期"
    };

    render(<Component domId="field-d" field={field} value="" onChange={onChange} />);

    await user.type(screen.getByRole("textbox"), "2025-01-15{Enter}");

    expect(onChange).toHaveBeenCalledWith("2025-01-15");
  });

  it("renders two inputs for a date range", () => {
    const { Component } = dateRangeFieldDefinition;

    if (!Component) {
      throw new Error("date range field is missing a Component");
    }

    const field: DateRangeField = {
      id: "R",
      type: "daterange",
      key: "r",
      label: "区间"
    };

    render(<Component domId="field-r" field={field} value={[]} onChange={vi.fn()} />);

    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("commits an empty string when the date is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = dateFieldDefinition;

    if (!Component) {
      throw new Error("date field is missing a Component");
    }

    const field: DateField = {
      id: "D",
      type: "date",
      key: "d",
      label: "日期"
    };

    render(<Component domId="field-d" field={field} value="2025-01-15" onChange={onChange} />);

    await user.click(getClearAffordance());

    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("commits an empty array when the range is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = dateRangeFieldDefinition;

    if (!Component) {
      throw new Error("date range field is missing a Component");
    }

    const field: DateRangeField = {
      id: "R",
      type: "daterange",
      key: "r",
      label: "区间"
    };

    render(<Component domId="field-r" field={field} value={["2025-01-01", "2025-01-15"]} onChange={onChange} />);

    await user.click(getClearAffordance());

    // The cleared payload is `[]`, matching the mobile renderer — never the
    // `["", ""]` pair antd's dateStrings carry on clear.
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("hides the clear affordance when allowClear is false", () => {
    const { Component } = dateFieldDefinition;

    if (!Component) {
      throw new Error("date field is missing a Component");
    }

    const field: DateField = {
      id: "D",
      type: "date",
      key: "d",
      label: "日期",
      allowClear: false
    };

    render(<Component domId="field-d" field={field} value="2025-01-15" onChange={vi.fn()} />);

    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".ant-picker-clear")).not.toBeInTheDocument();
  });

  it("hides the clear affordance on the datetime field when allowClear is false", () => {
    const { Component } = datetimeFieldDefinition;

    if (!Component) {
      throw new Error("datetime field is missing a Component");
    }

    const field: DatetimeField = {
      id: "T",
      type: "datetime",
      key: "t",
      label: "日期时间",
      allowClear: false
    };

    render(<Component domId="field-t" field={field} value="2025-01-15 08:30:00" onChange={vi.fn()} />);

    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".ant-picker-clear")).not.toBeInTheDocument();
  });

  it("hides the clear affordance on the range field when allowClear is false", () => {
    const { Component } = dateRangeFieldDefinition;

    if (!Component) {
      throw new Error("date range field is missing a Component");
    }

    const field: DateRangeField = {
      id: "R",
      type: "daterange",
      key: "r",
      label: "区间",
      allowClear: false
    };

    render(<Component domId="field-r" field={field} value={["2025-01-01", "2025-01-15"]} onChange={vi.fn()} />);

    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".ant-picker-clear")).not.toBeInTheDocument();
  });

  it("renders an unparseable stored value as an empty picker without crashing", () => {
    const { Component } = dateFieldDefinition;

    if (!Component) {
      throw new Error("date field is missing a Component");
    }

    const field: DateField = {
      id: "D",
      type: "date",
      key: "d",
      label: "日期"
    };

    render(<Component domId="field-d" field={field} value="not-a-date" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});
