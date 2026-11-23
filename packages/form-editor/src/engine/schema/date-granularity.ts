import type {
  DateField,
  DateGranularity,
  DateRangeField,
  FormField,
  LinkageOperator,
  PropertyEntryOption
} from "../../types";

import { isValidDateByGranularity, isValidDateRangeByGranularity } from "@vef-framework-react/shared";

export type DateGranularityField = DateField | DateRangeField;

/**
 * Type guard narrowing a form field to the two calendar types that carry
 * {@link DateGranularity} (`date` and `daterange`; `datetime` is a fixed
 * timestamp with no granularity).
 */
export function isDateGranularityField(field: FormField): field is DateGranularityField {
  return field.type === "date" || field.type === "daterange";
}

/**
 * antd `DatePicker` / `RangePicker` `picker` prop corresponding to a
 * {@link DateGranularity}. Omitted granularity defaults to `"date"` (day).
 */
export function antdPickerForGranularity(granularity: DateGranularity | undefined): "year" | "quarter" | "month" | "date" {
  switch (granularity) {
    case "year": {
      return "year";
    }

    case "quarter": {
      return "quarter";
    }

    case "month": {
      return "month";
    }

    default: {
      return "date";
    }
  }
}

/**
 * Options offered by the「精度」select on `date` and `daterange` fields.
 */
export const DATE_GRANULARITY_OPTIONS: PropertyEntryOption[] = [
  { value: "year", label: "年 (YYYY)" },
  { value: "quarter", label: "季度 (YYYY-Qn)" },
  { value: "month", label: "月 (YYYY-MM)" },
  { value: "day", label: "日 (YYYY-MM-DD)" }
];

/**
 * Whether a stored linkage literal carries no value and therefore cannot
 * conflict with a granularity change.
 */
export function isEmptyDateLiteral(value: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  return Array.isArray(value) && value.length === 0;
}

/**
 * Whether a linkage literal value is valid under `nextGranularity` for a
 * `date` or `daterange` field. Empty values are always compatible.
 */
export function isDateLiteralCompatible(
  fieldType: "date" | "daterange",
  value: unknown,
  nextGranularity: DateGranularity,
  operator?: LinkageOperator
): boolean {
  if (isEmptyDateLiteral(value)) {
    return true;
  }

  if (fieldType === "date") {
    return isValidDateByGranularity(value, nextGranularity);
  }

  if (operator === "contains" && typeof value === "string") {
    return isValidDateByGranularity(value, nextGranularity);
  }

  return isValidDateRangeByGranularity(value, nextGranularity);
}

/**
 * Return `field` with its `granularity` set to `nextGranularity` (normalizing
 * the default `"day"` by deleting the key). Identity-preserving: returns
 * `field` unchanged when the normalized granularity is already in place.
 */
export function withFieldGranularity<F extends DateGranularityField>(field: F, nextGranularity: DateGranularity): F {
  const normalized = nextGranularity === "day" ? undefined : nextGranularity;

  if (field.granularity === normalized) {
    return field;
  }

  const next = { ...field };

  if (normalized === undefined) {
    delete next.granularity;
  } else {
    next.granularity = normalized;
  }

  return next;
}
