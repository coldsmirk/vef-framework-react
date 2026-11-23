import type { DateField, DateRangeField, DatetimeField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { dateFieldDefinition, dateRangeFieldDefinition, datetimeFieldDefinition } from "./index";

function getClearAffordance(): Element {
  // antd's clear affordance is an aria-hidden span (its documented styling
  // hook `.ant-picker-clear`) with no accessible handle, so reach for it via
  // document.querySelector.

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
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
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
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
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

  it("displays and formats each date granularity (year, quarter, month, day)", () => {
    const { Component } = dateFieldDefinition;

    if (!Component) {
      throw new Error("date field is missing a Component");
    }

    const cases = [
      {
        granularity: "year" as const,
        valid: "2026",
        wrong: "2026-04-15"
      },
      {
        granularity: "quarter" as const,
        valid: "2026-Q4",
        wrong: "2026-04"
      },
      {
        granularity: "month" as const,
        valid: "2026-04",
        wrong: "2026-04-15"
      },
      {
        granularity: "day" as const,
        valid: "2026-04-15",
        wrong: "2026-04"
      }
    ];

    for (const {
      granularity,
      valid,
      wrong
    } of cases) {
      const field: DateField = {
        id: `D_${granularity}`,
        type: "date",
        key: `d_${granularity}`,
        label: "日期",
        granularity
      };

      const { rerender, unmount } = render(<Component domId={`field-${granularity}`} field={field} value={valid} onChange={vi.fn()} />);

      expect(screen.getByRole("textbox")).toHaveValue(valid);

      // A value from another granularity is rejected strictly and renders empty.
      rerender(<Component domId={`field-${granularity}`} field={field} value={wrong} onChange={vi.fn()} />);
      expect(screen.getByRole("textbox")).toHaveValue("");

      unmount();
    }
  });

  it("emits YYYY-Qn when a quarter is selected from the PC picker", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = dateFieldDefinition;

    if (!Component) {
      throw new Error("date field is missing a Component");
    }

    const field: DateField = {
      id: "DQ",
      type: "date",
      key: "dq",
      label: "季度",
      granularity: "quarter"
    };

    render(<Component domId="field-dq" field={field} value="2026-Q1" onChange={onChange} />);

    await user.click(screen.getByRole("textbox"));
    await user.click(await screen.findByText("Q4"));

    expect(onChange).toHaveBeenCalledWith("2026-Q4");
  });

  it("displays each daterange granularity and clears to an empty array", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const onChange = vi.fn();
    const { Component } = dateRangeFieldDefinition;

    if (!Component) {
      throw new Error("date range field is missing a Component");
    }

    const cases = [
      { granularity: "year" as const, pair: ["2024", "2026"] },
      { granularity: "quarter" as const, pair: ["2026-Q1", "2026-Q4"] },
      { granularity: "month" as const, pair: ["2026-01", "2026-06"] }
    ];

    for (const { granularity, pair } of cases) {
      const field: DateRangeField = {
        id: `R_${granularity}`,
        type: "daterange",
        key: `r_${granularity}`,
        label: "区间",
        granularity
      };

      const { unmount } = render(<Component domId={`field-r-${granularity}`} field={field} value={pair} onChange={onChange} />);
      const inputs = screen.getAllByRole("textbox");

      expect(inputs[0]).toHaveValue(pair[0]);
      expect(inputs[1]).toHaveValue(pair[1]);

      await user.click(getClearAffordance());
      expect(onChange).toHaveBeenLastCalledWith([]);

      unmount();
    }
  });

  it("exposes the granularity property on date and daterange, but not datetime", () => {
    const idsOf = (def: typeof dateFieldDefinition) => (def.properties ?? []).flatMap(group => group.entries.map(entry => entry.id));

    expect(idsOf(dateFieldDefinition)).toContain("granularity");
    expect(idsOf(dateRangeFieldDefinition)).toContain("granularity");
    expect(idsOf(datetimeFieldDefinition)).not.toContain("granularity");
  });
});
