import type { DateField, DateRangeField, DatetimeField, TextfieldField } from "../../types";

import {
  antdPickerForGranularity,
  isDateGranularityField,
  isDateLiteralCompatible,
  isEmptyDateLiteral,
  withFieldGranularity
} from "./date-granularity";

describe("date-granularity helpers", () => {
  describe("antdPickerForGranularity", () => {
    it("maps omitted and day granularity to date", () => {
      expect(antdPickerForGranularity(undefined)).toBe("date");
      expect(antdPickerForGranularity("day")).toBe("date");
    });

    it("maps year, quarter, and month to their matching antd pickers", () => {
      expect(antdPickerForGranularity("year")).toBe("year");
      expect(antdPickerForGranularity("quarter")).toBe("quarter");
      expect(antdPickerForGranularity("month")).toBe("month");
    });
  });

  describe("isDateGranularityField", () => {
    it("accepts date and daterange fields", () => {
      const date: DateField = {
        id: "d1",
        type: "date",
        key: "period"
      };
      const range: DateRangeField = {
        id: "r1",
        type: "daterange",
        key: "span"
      };

      expect(isDateGranularityField(date)).toBe(true);
      expect(isDateGranularityField(range)).toBe(true);
    });

    it("rejects datetime and non-date fields", () => {
      const datetime: DatetimeField = {
        id: "dt1",
        type: "datetime",
        key: "at"
      };
      const text: TextfieldField = {
        id: "t1",
        type: "textfield",
        key: "note"
      };

      expect(isDateGranularityField(datetime)).toBe(false);
      expect(isDateGranularityField(text)).toBe(false);
    });
  });

  describe("isEmptyDateLiteral", () => {
    it("treats nullish, empty string, and empty array as empty", () => {
      expect(isEmptyDateLiteral(undefined)).toBe(true);
      expect(isEmptyDateLiteral(null)).toBe(true);
      expect(isEmptyDateLiteral("")).toBe(true);
      expect(isEmptyDateLiteral([])).toBe(true);
    });

    it("treats non-empty strings and populated arrays as non-empty", () => {
      expect(isEmptyDateLiteral("2026-04")).toBe(false);
      expect(isEmptyDateLiteral(["2026-01", "2026-04"])).toBe(false);
    });
  });

  describe("isDateLiteralCompatible", () => {
    it("always accepts empty values", () => {
      expect(isDateLiteralCompatible("date", "", "month")).toBe(true);
      expect(isDateLiteralCompatible("daterange", [], "quarter")).toBe(true);
    });

    it("validates single date strings strictly against the target granularity", () => {
      expect(isDateLiteralCompatible("date", "2026", "year")).toBe(true);
      expect(isDateLiteralCompatible("date", "2026-Q2", "quarter")).toBe(true);
      expect(isDateLiteralCompatible("date", "2026-04", "month")).toBe(true);
      expect(isDateLiteralCompatible("date", "2026-04-15", "day")).toBe(true);
      expect(isDateLiteralCompatible("date", "2026-04-15", "month")).toBe(false);
      expect(isDateLiteralCompatible("date", "2026-04", "quarter")).toBe(false);
    });

    it("validates daterange pairs and allows single-date contains operands", () => {
      expect(isDateLiteralCompatible("daterange", ["2026-Q1", "2026-Q4"], "quarter")).toBe(true);
      expect(isDateLiteralCompatible("daterange", ["2026-01-01", "2026-12-31"], "quarter")).toBe(false);
      expect(isDateLiteralCompatible("daterange", "2026-Q2", "quarter", "contains")).toBe(true);
      expect(isDateLiteralCompatible("daterange", "2026-04-15", "quarter", "contains")).toBe(false);
    });
  });

  describe("withFieldGranularity", () => {
    it("sets non-default granularity on a date field", () => {
      const field: DateField = {
        id: "D1",
        type: "date",
        key: "period"
      };

      const updated = withFieldGranularity(field, "month");

      expect(updated.granularity).toBe("month");
      expect(updated).not.toBe(field);
    });

    it("drops the granularity key when switching back to default day", () => {
      const field: DateField = {
        id: "D1",
        type: "date",
        key: "period",
        granularity: "quarter"
      };

      const updated = withFieldGranularity(field, "day");

      expect("granularity" in updated).toBe(false);
    });

    it("returns the input reference unchanged when the normalized granularity already matches", () => {
      const defaultField: DateField = {
        id: "D1",
        type: "date",
        key: "period"
      };
      const monthField: DateField = {
        id: "D2",
        type: "date",
        key: "period",
        granularity: "month"
      };

      expect(withFieldGranularity(defaultField, "day")).toBe(defaultField);
      expect(withFieldGranularity(monthField, "month")).toBe(monthField);
    });
  });
});
