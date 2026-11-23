import type {
  DateField,
  DateGranularity,
  DateRangeField,
  DatetimeField,
  FormField,
  MultiSelectField,
  SelectField
} from "../../types";

/**
 * Field types that carry a built-in default placeholder when the author leaves
 * `placeholder` unset. Text / numeric inputs stay blank by default on both PC
 * and mobile; picker and dropdown controls carry an explicit prompt shared by
 * PC, mobile, table columns, and canvas sample cells.
 */
export type DefaultPlaceholderField = DateField | DatetimeField | DateRangeField | SelectField | MultiSelectField;

const GRANULARITY_UNIT: Record<DateGranularity, string> = {
  year: "年份",
  quarter: "季度",
  month: "月份",
  day: "日期"
};

/**
 * Default single-string placeholder for a field by its type and calendar
 * granularity — the one source of truth shared by PC, mobile, table-column
 * editors, and canvas sample cells.
 */
export function defaultFieldPlaceholder(field: DefaultPlaceholderField): string;
export function defaultFieldPlaceholder(field: FormField): string | undefined;

export function defaultFieldPlaceholder(field: FormField): string | undefined {
  switch (field.type) {
    case "select": {
      return "请选择";
    }

    case "multi-select": {
      return "请选择";
    }

    case "date": {
      return `请选择${GRANULARITY_UNIT[field.granularity ?? "day"]}`;
    }

    case "datetime": {
      return "请选择日期时间";
    }

    case "daterange": {
      return `请选择${GRANULARITY_UNIT[field.granularity ?? "day"]}区间`;
    }

    default: {
      return undefined;
    }
  }
}

/**
 * Effective single-string placeholder for a field: an explicit non-empty
 * `field.placeholder` always wins, falling back to {@link defaultFieldPlaceholder}.
 */
export function resolveFieldPlaceholder(field: DefaultPlaceholderField): string;
export function resolveFieldPlaceholder(field: FormField): string | undefined;

export function resolveFieldPlaceholder(field: FormField): string | undefined {
  const explicit = "placeholder" in field && typeof field.placeholder === "string"
    ? field.placeholder
    : undefined;

  return explicit && explicit.length > 0 ? explicit : defaultFieldPlaceholder(field);
}

/**
 * Default `[start, end]` placeholder pair for a dual-input range picker (PC
 * `DatePicker.RangePicker`), derived from the same granularity vocabulary as
 * {@link defaultFieldPlaceholder}.
 */
export function resolveDateRangePlaceholderPair(granularity: DateGranularity | undefined): [string, string] {
  const unit = GRANULARITY_UNIT[granularity ?? "day"];

  return [`开始${unit}`, `结束${unit}`];
}
