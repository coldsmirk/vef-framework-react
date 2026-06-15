import type { ReactElement } from "react";

import type { DateRangeField, FieldComponentProps } from "../../types";

import { DEFAULT_DATE_FORMAT } from "@vef-framework-react/shared";
import CalendarPicker from "antd-mobile/es/components/calendar-picker";
import { useState } from "react";

import { EditorIcon } from "../../icons";
import { FieldShell } from "../../render/parts/field-shell";
import { formatTrigger, fromPickerDate, toPickerDate } from "./date-adapters";
import { PickerTrigger } from "./picker-trigger";
import { useMobileScopeContainer } from "./scope";

const EMPTY_RANGE: string[] = [];

/**
 * Seed the calendar's `[Date, Date]` selection from the stored `[start, end]`
 * pair. Returns `null` (no preselection) unless both endpoints are present and
 * parseable, matching the PC field's "a range is set only when it has two
 * valid ends" semantics.
 */
function toRange(value: string[]): [Date, Date] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const start = toPickerDate(value[0] ?? "");
  const end = toPickerDate(value[1] ?? "");
  return start && end ? [start, end] : null;
}

/**
 * Mobile renderer for the date-range field. Mirrors the PC `date-field`
 * contract: same `FieldComponentProps<DateRangeField, string[]>`, the same
 * `[startStr, endStr]` pair of `YYYY-MM-DD` strings (empty `[]` when unset),
 * and the same label / helper / error / required shell. The control is an
 * antd-mobile `CalendarPicker` in range mode rather than the antd
 * `RangePicker`.
 */
export function MobileDateRangeInput({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value = EMPTY_RANGE,
  onChange
}: FieldComponentProps<DateRangeField, string[]>): ReactElement {
  const [visible, setVisible] = useState(false);
  const getContainer = useMobileScopeContainer();

  const start = formatTrigger(value[0] ?? "", DEFAULT_DATE_FORMAT);
  const end = formatTrigger(value[1] ?? "", DEFAULT_DATE_FORMAT);
  const display = start && end ? `${start} 至 ${end}` : "";

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "日期区间"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <PickerTrigger
        disabled={disabled}
        display={display}
        domId={domId}
        hasError={Boolean(errors?.length)}
        placeholder="请选择日期区间"
        trailing={<EditorIcon name="calendar-range" />}
        // Clearable by default, matching the PC RangePicker (allowClear default-on);
        // a stored `allowClear: false` drops the affordance. Clearing commits the
        // cleared range shape `[]`.
        onClear={(field.allowClear ?? true) ? () => onChange(EMPTY_RANGE) : undefined}
        onOpen={() => setVisible(true)}
      />

      <CalendarPicker
        getContainer={getContainer}
        selectionMode="range"
        title={field.label ?? "日期区间"}
        value={toRange(value)}
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={range => onChange(
          range
            ? [fromPickerDate(range[0], DEFAULT_DATE_FORMAT), fromPickerDate(range[1], DEFAULT_DATE_FORMAT)]
            : EMPTY_RANGE
        )}
      />
    </FieldShell>
  );
}
