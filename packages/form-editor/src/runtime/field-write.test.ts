import type {
  CheckboxGroupField,
  CodeEditorField,
  DateField,
  DateRangeField,
  DatetimeField,
  FieldOption,
  KeyedFormField,
  MultiSelectField,
  NumberField,
  RadioField,
  SelectField,
  SwitchField,
  TextareaField,
  TextfieldField,
  UploadField
} from "../types";

import { DEFAULT_DATETIME_FORMAT, formatDate, parseDate } from "@vef-framework-react/shared";
import { describe, expect, it } from "vitest";

import { normalizeFieldValue, writeFieldValue } from "./field-write";

function formStub(current: unknown): { form: any; written: unknown[] } {
  const written: unknown[] = [];

  return {
    written,
    form: {
      getFieldValue: () => current,
      setFieldValue: (_name: string, value: unknown) => {
        written.push(value);
      }
    }
  };
}

function write(
  field: KeyedFormField,
  value: unknown,
  options: {
    current?: unknown;
    disabled?: boolean;
    fieldPermissions?: Record<string, "editable" | "visible" | "hidden">;
    knownOptions?: readonly FieldOption[];
  } = {}
): unknown[] {
  const { form, written } = formStub(options.current);

  writeFieldValue({
    disabled: options.disabled,
    fieldPermissions: options.fieldPermissions,
    form,
    key: "target",
    knownOptions: options.knownOptions,
    prefix: "",
    targetField: field,
    value
  });

  return written;
}

const textField: TextfieldField = {
  id: "f1",
  type: "textfield",
  key: "target"
};
const textareaField: TextareaField = {
  id: "f2",
  type: "textarea",
  key: "target"
};
const codeEditorField: CodeEditorField = {
  id: "f3",
  type: "code-editor",
  key: "target"
};
const numberField: NumberField = {
  id: "f4",
  type: "number",
  key: "target"
};
const switchField: SwitchField = {
  id: "f5",
  type: "switch",
  key: "target"
};
const dayDateField: DateField = {
  id: "f6",
  type: "date",
  key: "target",
  granularity: "day"
};
const monthDateField: DateField = {
  id: "f7",
  type: "date",
  key: "target",
  granularity: "month"
};
const quarterDateField: DateField = {
  id: "f8",
  type: "date",
  key: "target",
  granularity: "quarter"
};
const yearDateField: DateField = {
  id: "f9",
  type: "date",
  key: "target",
  granularity: "year"
};
const datetimeField: DatetimeField = {
  id: "f10",
  type: "datetime",
  key: "target"
};
const dayRangeField: DateRangeField = {
  id: "f11",
  type: "daterange",
  key: "target",
  granularity: "day"
};
const monthRangeField: DateRangeField = {
  id: "f12",
  type: "daterange",
  key: "target",
  granularity: "month"
};
const quarterRangeField: DateRangeField = {
  id: "f13",
  type: "daterange",
  key: "target",
  granularity: "quarter"
};
const yearRangeField: DateRangeField = {
  id: "f14",
  type: "daterange",
  key: "target",
  granularity: "year"
};
const selectField: SelectField = {
  id: "f15",
  type: "select",
  key: "target"
};
const radioField: RadioField = {
  id: "f16",
  type: "radio",
  key: "target"
};
const multiSelectField: MultiSelectField = {
  id: "f17",
  type: "multi-select",
  key: "target"
};
const checkboxGroupField: CheckboxGroupField = {
  id: "f18",
  type: "checkbox-group",
  key: "target"
};
const uploadField: UploadField = {
  id: "f19",
  type: "upload",
  key: "target"
};

describe("normalizeFieldValue", () => {
  describe("text-like widgets (textfield / textarea / code-editor)", () => {
    it("stringifies finite scalars and clears nullish, non-finite, or object values", () => {
      expect(normalizeFieldValue(textField, "hello")).toBe("hello");
      expect(normalizeFieldValue(textField, 42)).toBe("42");
      expect(normalizeFieldValue(textField, true)).toBe("true");
      expect(normalizeFieldValue(textField, undefined)).toBe("");
      expect(normalizeFieldValue(textField, null)).toBe("");
      expect(normalizeFieldValue(textField, NaN)).toBe("");
      expect(normalizeFieldValue(textField, Infinity)).toBe("");
      expect(normalizeFieldValue(textField, { nested: 1 })).toBe("");

      expect(normalizeFieldValue(textareaField, 100)).toBe("100");
      expect(normalizeFieldValue(codeEditorField, "const x = 1;")).toBe("const x = 1;");
      expect(normalizeFieldValue(codeEditorField, [1, 2])).toBe("");
    });
  });

  describe("number widget", () => {
    it("parses finite numeric literals and clears blank, non-numeric, or non-finite values", () => {
      expect(normalizeFieldValue(numberField, 42)).toBe(42);
      expect(normalizeFieldValue(numberField, "200")).toBe(200);
      expect(normalizeFieldValue(numberField, " 3.5 ")).toBe(3.5);
      expect(normalizeFieldValue(numberField, "")).toBeUndefined();
      expect(normalizeFieldValue(numberField, " ".repeat(3))).toBeUndefined();
      expect(normalizeFieldValue(numberField, "abc")).toBeUndefined();
      expect(normalizeFieldValue(numberField, NaN)).toBeUndefined();
      expect(normalizeFieldValue(numberField, Infinity)).toBeUndefined();
      expect(normalizeFieldValue(numberField, true)).toBeUndefined();
      expect(normalizeFieldValue(numberField, null)).toBeUndefined();
    });
  });

  describe("switch widget", () => {
    it("normalizes booleans, 1/0, and true/false/1/0 strings to boolean", () => {
      expect(normalizeFieldValue(switchField, true)).toBe(true);
      expect(normalizeFieldValue(switchField, false)).toBe(false);
      expect(normalizeFieldValue(switchField, 1)).toBe(true);
      expect(normalizeFieldValue(switchField, 0)).toBe(false);
      expect(normalizeFieldValue(switchField, "true")).toBe(true);
      expect(normalizeFieldValue(switchField, " TRUE ")).toBe(true);
      expect(normalizeFieldValue(switchField, "1")).toBe(true);
      expect(normalizeFieldValue(switchField, "false")).toBe(false);
      expect(normalizeFieldValue(switchField, "0")).toBe(false);
      expect(normalizeFieldValue(switchField, undefined)).toBe(false);
      expect(normalizeFieldValue(switchField, "yes")).toBe(false);
    });
  });

  describe("date widget across all granularities", () => {
    it("formats day granularity strictly and rejects invalid calendar dates or coarser inputs", () => {
      expect(normalizeFieldValue(dayDateField, "2026-04-15")).toBe("2026-04-15");
      expect(normalizeFieldValue(dayDateField, "2026/04/15")).toBe("2026-04-15");
      expect(normalizeFieldValue(dayDateField, "2026-04-15 10:20:30")).toBe("2026-04-15");
      expect(normalizeFieldValue(dayDateField, new Date(2026, 3, 15))).toBe("2026-04-15");
      // Never fabricates day 01 from coarser inputs.
      expect(normalizeFieldValue(dayDateField, "2026-04")).toBe("");
      expect(normalizeFieldValue(dayDateField, "2026-Q2")).toBe("");
      expect(normalizeFieldValue(dayDateField, "2026")).toBe("");
      // Rejects impossible calendar dates (2026 is not a leap year).
      expect(normalizeFieldValue(dayDateField, "2026-02-29")).toBe("");
      expect(normalizeFieldValue(dayDateField, "2026-04-31")).toBe("");
      expect(normalizeFieldValue(dayDateField, "not-a-date")).toBe("");
      expect(normalizeFieldValue(dayDateField, new Date("invalid"))).toBe("");
    });

    it("projects finer inputs onto month, quarter, and year without inventing precision", () => {
      expect(normalizeFieldValue(monthDateField, "2026-04")).toBe("2026-04");
      expect(normalizeFieldValue(monthDateField, "2026-04-15")).toBe("2026-04");
      expect(normalizeFieldValue(monthDateField, "2026/04")).toBe("2026-04");
      expect(normalizeFieldValue(monthDateField, "2026-Q2")).toBe("");
      expect(normalizeFieldValue(monthDateField, "2026")).toBe("");
      expect(normalizeFieldValue(monthDateField, "2026-13")).toBe("");

      expect(normalizeFieldValue(quarterDateField, "2026-Q2")).toBe("2026-Q2");
      expect(normalizeFieldValue(quarterDateField, "2026-04")).toBe("2026-Q2");
      expect(normalizeFieldValue(quarterDateField, "2026-10-05")).toBe("2026-Q4");
      expect(normalizeFieldValue(quarterDateField, "2026")).toBe("");
      expect(normalizeFieldValue(quarterDateField, "2026-Q5")).toBe("");

      expect(normalizeFieldValue(yearDateField, "2026")).toBe("2026");
      expect(normalizeFieldValue(yearDateField, "2026-Q3")).toBe("2026");
      expect(normalizeFieldValue(yearDateField, "2026-08")).toBe("2026");
      expect(normalizeFieldValue(yearDateField, "2026-08-19")).toBe("2026");
      expect(normalizeFieldValue(yearDateField, "2026-02-30")).toBe("");
    });
  });

  describe("datetime widget", () => {
    it("formats valid local, zoned ISO, and Date inputs to YYYY-MM-DD HH:mm:ss and rejects invalid dates or clocks", () => {
      expect(normalizeFieldValue(datetimeField, "2026-04-15 09:30:45")).toBe("2026-04-15 09:30:45");
      expect(normalizeFieldValue(datetimeField, "2026-04-15T09:30")).toBe("2026-04-15 09:30:00");
      expect(normalizeFieldValue(datetimeField, "2026/04/15 23:59:59")).toBe("2026-04-15 23:59:59");
      expect(normalizeFieldValue(datetimeField, new Date(2026, 3, 15, 8, 5, 9))).toBe("2026-04-15 08:05:09");

      const zonedIso = "2026-04-15T10:30:00Z";
      const expectedLocal = formatDate(parseDate(new Date(zonedIso)), DEFAULT_DATETIME_FORMAT);
      expect(normalizeFieldValue(datetimeField, zonedIso)).toBe(expectedLocal);

      // Date-only does not fabricate 00:00:00; invalid dates and clocks clear.
      expect(normalizeFieldValue(datetimeField, "2026-04-15")).toBe("");
      expect(normalizeFieldValue(datetimeField, "2026-02-29 10:00:00")).toBe("");
      expect(normalizeFieldValue(datetimeField, "2026-04-15 24:00:00")).toBe("");
      expect(normalizeFieldValue(datetimeField, "2026-04-15 10:60:00")).toBe("");
      expect(normalizeFieldValue(datetimeField, undefined)).toBe("");
    });
  });

  describe("daterange widget", () => {
    it("accepts ordered pairs matching granularity and clears reversed, malformed, or under-specified ranges", () => {
      expect(normalizeFieldValue(dayRangeField, ["2026-04-01", "2026-04-15"])).toEqual(["2026-04-01", "2026-04-15"]);
      expect(normalizeFieldValue(dayRangeField, ["2026-04-15", "2026-04-15"])).toEqual(["2026-04-15", "2026-04-15"]);
      expect(normalizeFieldValue(dayRangeField, ["2026-04-16", "2026-04-15"])).toEqual([]);
      expect(normalizeFieldValue(dayRangeField, ["2026-04", "2026-05"])).toEqual([]);
      expect(normalizeFieldValue(dayRangeField, ["2026-04-01"])).toEqual([]);
      expect(normalizeFieldValue(dayRangeField, "2026-04-01")).toEqual([]);

      expect(normalizeFieldValue(monthRangeField, ["2026-01-10", "2026-06-20"])).toEqual(["2026-01", "2026-06"]);
      expect(normalizeFieldValue(quarterRangeField, ["2026-Q1", "2026-Q3"])).toEqual(["2026-Q1", "2026-Q3"]);
      expect(normalizeFieldValue(yearRangeField, ["2025", "2026"])).toEqual(["2025", "2026"]);
      expect(normalizeFieldValue(yearRangeField, ["2027", "2026"])).toEqual([]);
    });
  });

  describe("single-option widgets (select / radio)", () => {
    const numericOptions: FieldOption[] = [
      { label: "Active", value: 1 },
      { label: "Inactive", value: 2 }
    ];
    const stringOptions: FieldOption[] = [
      { label: "Engineering", value: "eng" },
      { label: "Operations", value: "ops" }
    ];

    it("aligns scalar type to knownOptions and clears unmatched or non-scalar values", () => {
      expect(normalizeFieldValue(selectField, "1", numericOptions)).toBe(1);
      expect(normalizeFieldValue(selectField, 2, numericOptions)).toBe(2);
      expect(normalizeFieldValue(selectField, "99", numericOptions)).toBe("");
      expect(normalizeFieldValue(radioField, "eng", stringOptions)).toBe("eng");
      expect(normalizeFieldValue(radioField, "unknown", stringOptions)).toBe("");
      expect(normalizeFieldValue(selectField, undefined, stringOptions)).toBe("");
      expect(normalizeFieldValue(selectField, ["eng"], stringOptions)).toBe("");
    });

    it("preserves finite scalars when option list is unknown or empty", () => {
      expect(normalizeFieldValue(selectField, "dept_01")).toBe("dept_01");
      expect(normalizeFieldValue(selectField, 7, [])).toBe(7);
      expect(normalizeFieldValue(selectField, NaN)).toBe("");
      expect(normalizeFieldValue(selectField, "")).toBe("");
    });
  });

  describe("multi-option widgets (multi-select / checkbox-group)", () => {
    const numericOptions: FieldOption[] = [
      { label: "Tag A", value: 10 },
      { label: "Tag B", value: 20 }
    ];

    it("aligns, filters, and deduplicates against knownOptions and clears non-array values", () => {
      expect(normalizeFieldValue(multiSelectField, ["10", 20, "10", "999", null], numericOptions)).toEqual([10, 20]);
      expect(normalizeFieldValue(checkboxGroupField, ["999"], numericOptions)).toEqual([]);
      expect(normalizeFieldValue(multiSelectField, "10", numericOptions)).toEqual([]);
      expect(normalizeFieldValue(multiSelectField, undefined, numericOptions)).toEqual([]);
    });

    it("deduplicates finite scalars when option list is unknown", () => {
      expect(normalizeFieldValue(checkboxGroupField, ["a", "b", "a", "", NaN, { x: 1 }])).toEqual(["a", "b"]);
    });
  });
});

describe("writeFieldValue guards and no-op bail", () => {
  it("normalizes and writes through to form state", () => {
    expect(write(numberField, "200")).toEqual([200]);
    expect(write(numberField, "", { current: 1 })).toEqual([undefined]);
    expect(write(switchField, "false", { current: true })).toEqual([false]);
    expect(write(textField, 42)).toEqual(["42"]);
  });

  it("bails when the normalized value deeply equals what the field holds", () => {
    expect(write(numberField, "200", { current: 200 })).toEqual([]);
    expect(write(dayRangeField, ["2026-04-01", "2026-04-15"], { current: ["2026-04-01", "2026-04-15"] })).toEqual([]);
  });

  it("skips writes on disabled forms, non-writable permissions, and upload fields", () => {
    expect(write(textField, "next", { disabled: true })).toEqual([]);
    expect(write(textField, "next", { fieldPermissions: { target: "visible" } })).toEqual([]);
    expect(write(textField, "next", { fieldPermissions: { target: "hidden" } })).toEqual([]);
    expect(write(textField, "next", { fieldPermissions: { target: "editable" } })).toEqual(["next"]);
    expect(write(uploadField, [{ id: "file-1" }])).toEqual([]);
  });
});
