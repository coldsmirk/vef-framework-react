import type { ReactElement } from "react";

import type { DateField, DateGranularity, FieldComponentProps } from "../../types";

import DatePicker from "antd-mobile/es/components/date-picker";
import Picker from "antd-mobile/es/components/picker";
import { useState } from "react";

import { EditorIcon } from "../../icons";
import { FieldShell } from "../../render/parts/field-shell";
import { resolveFieldPlaceholder } from "../../render/parts/placeholder";
import {
  formatGranularityTrigger,
  fromGranularityPickerDate,
  fromQuarterColumnsValue,
  PICKER_MAX_DATE,
  PICKER_MIN_DATE,
  QUARTER_PICKER_COLUMNS,
  toGranularityPickerDate,
  toQuarterColumnsValue
} from "./date-adapters";
import { PickerTrigger } from "./picker-trigger";
import { useMobileScopeContainer } from "./scope";

/**
 * Mobile renderer for the single-value date field across every
 * {@link DateGranularity}. `year` / `month` / `day` delegate to antd-mobile's
 * `DatePicker` at matching `precision`; `quarter` uses a custom two-column
 * `Picker` (year + Q1–Q4) because antd-mobile `DatePicker` has no quarter
 * precision. Serializes through the shared helpers so PC and mobile round-trip
 * byte-identically.
 */
export function MobileDateInput({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value = "",
  onChange
}: FieldComponentProps<DateField, string>): ReactElement {
  const [visible, setVisible] = useState(false);
  const getContainer = useMobileScopeContainer();

  const granularity: DateGranularity = field.granularity ?? "day";
  const display = formatGranularityTrigger(value, granularity);
  const placeholder = resolveFieldPlaceholder(field);
  const title = field.label ?? "日期";

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={title}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <PickerTrigger
        disabled={disabled}
        display={display}
        domId={domId}
        hasError={Boolean(errors?.length)}
        placeholder={placeholder}
        trailing={<EditorIcon name="calendar" />}
        // Clearable by default, matching the PC DatePicker (allowClear default-on);
        // a stored `allowClear: false` drops the affordance. Clearing commits the
        // field's empty value `""`.
        onClear={(field.allowClear ?? true) ? () => onChange("") : undefined}
        onOpen={() => setVisible(true)}
      />

      {granularity === "quarter"
        ? (
            <Picker
              columns={QUARTER_PICKER_COLUMNS}
              getContainer={getContainer}
              title={title}
              value={toQuarterColumnsValue(value)}
              visible={visible}
              onClose={() => setVisible(false)}
              onConfirm={columns => {
                const next = fromQuarterColumnsValue(columns);

                if (next) {
                  onChange(next);
                }
              }}
            />
          )
        : (
            <DatePicker
              getContainer={getContainer}
              max={PICKER_MAX_DATE}
              min={PICKER_MIN_DATE}
              precision={granularity}
              title={title}
              value={toGranularityPickerDate(value, granularity)}
              visible={visible}
              onClose={() => setVisible(false)}
              onConfirm={date => onChange(fromGranularityPickerDate(date, granularity))}
            />
          )}
    </FieldShell>
  );
}
