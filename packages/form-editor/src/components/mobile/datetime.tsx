import type { ReactElement } from "react";

import type { DatetimeField, FieldComponentProps } from "../../types";

import { DEFAULT_DATETIME_FORMAT } from "@vef-framework-react/shared";
import DatePicker from "antd-mobile/es/components/date-picker";
import { useState } from "react";

import { EditorIcon } from "../../icons";
import { FieldShell } from "../../render/parts/field-shell";
import { formatTrigger, fromPickerDate, toPickerDate } from "./date-adapters";
import { PickerTrigger } from "./picker-trigger";
import { useMobileScopeContainer } from "./scope";

/**
 * Mobile renderer for the date + time field. Mirrors the PC `date-field`
 * contract: same `FieldComponentProps<DatetimeField, string>`, same
 * `YYYY-MM-DD HH:mm:ss` serialized value, same label / helper / error /
 * required shell. The PC field formats with full seconds, so the picker runs at
 * `precision="second"` to populate every part of that format.
 */
export function MobileDatetimeInput({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value = "",
  onChange
}: FieldComponentProps<DatetimeField, string>): ReactElement {
  const [visible, setVisible] = useState(false);
  const getContainer = useMobileScopeContainer();

  const display = formatTrigger(value, DEFAULT_DATETIME_FORMAT);
  const placeholder = field.placeholder ?? "请选择日期时间";

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "日期时间"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <PickerTrigger
        disabled={disabled}
        display={display}
        domId={domId}
        hasError={Boolean(errors?.length)}
        placeholder={placeholder}
        trailing={<EditorIcon name="clock" />}
        // Clearable by default, matching the PC DatePicker (allowClear default-on);
        // a stored `allowClear: false` drops the affordance. Clearing commits the
        // field's empty value `""`.
        onClear={(field.allowClear ?? true) ? () => onChange("") : undefined}
        onOpen={() => setVisible(true)}
      />

      <DatePicker
        getContainer={getContainer}
        precision="second"
        title={field.label ?? "日期时间"}
        value={toPickerDate(value)}
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={date => onChange(fromPickerDate(date, DEFAULT_DATETIME_FORMAT))}
      />
    </FieldShell>
  );
}
