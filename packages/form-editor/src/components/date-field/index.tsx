import type { ReactElement } from "react";

import type {
  DateField,
  DateRangeField,
  DatetimeField,
  FieldComponentProps,
  FieldDefinition,
  PropertiesDescriptor
} from "../../types";

import { DatePicker } from "@vef-framework-react/components";
import { DEFAULT_DATE_FORMAT, DEFAULT_DATETIME_FORMAT, tryParseDate } from "@vef-framework-react/shared";

import { FieldShell } from "../../render/parts/field-shell";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { requiredEntry } from "../field-entries";

const fullWidth = { width: "100%" } as const;

const EMPTY_RANGE: string[] = [];

/* ---------------------------------------------------------- single date/time */

/**
 * Shared renderer for the single-value date and datetime fields. They differ
 * only by whether a time part is shown, which is derived from `field.type`, so
 * one component serves both definitions. Values are stored as formatted strings
 * (JSON-serializable) and parsed back to a `Dayjs` for the controlled picker.
 * The serialized shape rests on the shared `DEFAULT_DATE_FORMAT` /
 * `DEFAULT_DATETIME_FORMAT` constants — the same ones the mobile adapters
 * format with — so the two presentations round-trip byte-identically.
 */
function SingleDateInput({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value = "",
  onChange
}: FieldComponentProps<DateField | DatetimeField, string>): ReactElement {
  const showTime = field.type === "datetime";

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? (showTime ? "日期时间" : "日期")}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <DatePicker
        allowClear={field.allowClear ?? true}
        disabled={disabled}
        format={showTime ? DEFAULT_DATETIME_FORMAT : DEFAULT_DATE_FORMAT}
        id={domId}
        placeholder={field.placeholder}
        showTime={showTime}
        status={errors?.length ? "error" : undefined}
        style={fullWidth}
        value={value ? tryParseDate(value) : null}
        onChange={(_date, dateString) => onChange(typeof dateString === "string" ? dateString : "")}
      />
    </FieldShell>
  );
}

function singleDateProperties(): PropertiesDescriptor {
  return [
    {
      id: "general",
      label: "通用",
      tab: "props",
      entries: [
        definePropertyEntry<DateField | DatetimeField, string | undefined>({
          id: "label",
          label: "标签",
          type: "text",
          read: field => field.label,
          write: (field, label) => { return { ...field, label }; }
        }),
        definePropertyEntry<DateField | DatetimeField, string | undefined>({
          id: "placeholder",
          label: "占位符",
          type: "text",
          read: field => field.placeholder,
          write: (field, placeholder) => { return { ...field, placeholder }; }
        }),
        definePropertyEntry<DateField | DatetimeField, string | undefined>({
          id: "helperText",
          label: "帮助文字",
          type: "text",
          read: field => field.helperText,
          write: (field, helperText) => { return { ...field, helperText }; }
        }),
        definePropertyEntry<DateField | DatetimeField, boolean>({
          id: "allowClear",
          label: "允许清除",
          type: "checkbox",
          read: field => field.allowClear ?? true,
          write: (field, allowClear) => { return { ...field, allowClear: allowClear === true }; }
        })
      ]
    },
    {
      id: "validation",
      label: "基础",
      tab: "validation",
      entries: [requiredEntry<DateField | DatetimeField>()]
    }
  ];
}

export const dateFieldDefinition: FieldDefinition = defineFieldDefinition<DateField, string>({
  config: {
    type: "date",
    name: "日期",
    group: "date-file",
    keyed: true,
    icon: "calendar",
    create: () => {
      return { type: "date", label: "日期" };
    }
  },
  Component: SingleDateInput,
  properties: singleDateProperties()
});

export const datetimeFieldDefinition: FieldDefinition = defineFieldDefinition<DatetimeField, string>({
  config: {
    type: "datetime",
    name: "日期时间",
    group: "date-file",
    keyed: true,
    icon: "clock",
    create: () => {
      return { type: "datetime", label: "日期时间" };
    }
  },
  Component: SingleDateInput,
  properties: singleDateProperties()
});

/* ----------------------------------------------------------------- date range */

function parseRange(value: string[]): [ReturnType<typeof tryParseDate>, ReturnType<typeof tryParseDate>] | null {
  return Array.isArray(value) && value.length === 2
    ? [tryParseDate(String(value[0])), tryParseDate(String(value[1]))]
    : null;
}

function DateRangeInput({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value = EMPTY_RANGE,
  onChange
}: FieldComponentProps<DateRangeField, string[]>): ReactElement {
  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "日期区间"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <DatePicker.RangePicker
        allowClear={field.allowClear ?? true}
        disabled={disabled}
        format={DEFAULT_DATE_FORMAT}
        id={domId}
        status={errors?.length ? "error" : undefined}
        style={fullWidth}
        value={parseRange(value)}
        // Clearing commits `[]` (the unset shape mobile writes too), never the
        // `["", ""]` pair the picker's dateStrings carry on clear.
        onChange={(dates, dateStrings) => onChange(dates === null
          ? EMPTY_RANGE
          : [dateStrings[0] ?? "", dateStrings[1] ?? ""])}
      />
    </FieldShell>
  );
}

const dateRangeProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<DateRangeField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => { return { ...field, label }; }
      }),
      definePropertyEntry<DateRangeField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        read: field => field.helperText,
        write: (field, helperText) => { return { ...field, helperText }; }
      }),
      definePropertyEntry<DateRangeField, boolean>({
        id: "allowClear",
        label: "允许清除",
        type: "checkbox",
        read: field => field.allowClear ?? true,
        write: (field, allowClear) => { return { ...field, allowClear: allowClear === true }; }
      })
    ]
  },
  {
    id: "validation",
    label: "基础",
    tab: "validation",
    entries: [requiredEntry<DateRangeField>()]
  }
];

export const dateRangeFieldDefinition: FieldDefinition = defineFieldDefinition<DateRangeField, string[]>({
  config: {
    type: "daterange",
    name: "日期区间",
    group: "date-file",
    keyed: true,
    icon: "calendar-range",
    create: () => {
      return { type: "daterange", label: "日期区间" };
    }
  },
  Component: DateRangeInput,
  properties: dateRangeProperties
});
