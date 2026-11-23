import type { Dayjs } from "@vef-framework-react/shared";
import type { ReactElement } from "react";

import type {
  DateField,
  DateGranularity,
  DateRangeField,
  DatetimeField,
  FieldComponentProps,
  FieldDefinition,
  PropertiesDescriptor
} from "../../types";

import { DatePicker } from "@vef-framework-react/components";
import {
  DEFAULT_DATETIME_FORMAT,
  formatDateByGranularity,
  getDateGranularityFormat,
  tryParseDate,
  tryParseDateByGranularity
} from "@vef-framework-react/shared";

import { antdPickerForGranularity } from "../../engine/schema/date-granularity";
import { FieldShell } from "../../render/parts/field-shell";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { dateGranularityEntry, requiredEntry } from "../field-entries";

const fullWidth = { width: "100%" } as const;

const EMPTY_RANGE: string[] = [];

/* ---------------------------------------------------------- single date/time */

/**
 * Shared renderer for the single-value date and datetime fields. `date` carries
 * a calendar {@link DateGranularity} (`year` / `quarter` / `month` / `day`);
 * `datetime` stays a fixed timestamp (`YYYY-MM-DD HH:mm:ss`). Both serialize
 * through the shared `@vef-framework-react/shared` helpers so PC and mobile
 * round-trip byte-identically.
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
  const granularity: DateGranularity = field.type === "date" ? (field.granularity ?? "day") : "day";
  const format = showTime ? DEFAULT_DATETIME_FORMAT : getDateGranularityFormat(granularity);
  let parsedValue = null;

  if (value) {
    parsedValue = showTime ? tryParseDate(value) : tryParseDateByGranularity(value, granularity);
  }

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
        format={format}
        id={domId}
        picker={showTime ? "date" : antdPickerForGranularity(granularity)}
        placeholder={field.placeholder}
        showTime={showTime}
        status={errors?.length ? "error" : undefined}
        style={fullWidth}
        value={parsedValue}
        onChange={(date, dateString) => {
          if (showTime) {
            onChange(typeof dateString === "string" ? dateString : "");
            return;
          }

          onChange(date ? formatDateByGranularity(date, granularity) : "");
        }}
      />
    </FieldShell>
  );
}

function singleDateProperties(withGranularity: boolean): PropertiesDescriptor {
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
        ...withGranularity ? [dateGranularityEntry<DateField>()] : [],
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
  properties: singleDateProperties(true)
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
  properties: singleDateProperties(false)
});

/* ----------------------------------------------------------------- date range */

/**
 * A range is set only when it has two valid ends for the field's granularity —
 * a pair with an unparseable end resolves to "unset" rather than a half-filled
 * picker, matching the mobile `toRange` semantics.
 */
function parseRange(value: string[], granularity: DateGranularity): [Dayjs, Dayjs] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const start = tryParseDateByGranularity(String(value[0]), granularity);
  const end = tryParseDateByGranularity(String(value[1]), granularity);

  return start && end ? [start, end] : null;
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
  const granularity: DateGranularity = field.granularity ?? "day";
  const format = getDateGranularityFormat(granularity);

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
        format={format}
        id={domId}
        picker={antdPickerForGranularity(granularity)}
        status={errors?.length ? "error" : undefined}
        style={fullWidth}
        value={parseRange(value, granularity)}
        // Clearing commits `[]` (the unset shape mobile writes too), never the
        // `["", ""]` pair the picker's dateStrings carry on clear.
        onChange={dates => onChange(
          dates?.[0] && dates[1]
            ? [formatDateByGranularity(dates[0], granularity), formatDateByGranularity(dates[1], granularity)]
            : EMPTY_RANGE
        )}
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
      dateGranularityEntry<DateRangeField>(),
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
