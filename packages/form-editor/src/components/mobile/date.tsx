import type { ReactElement } from "react";

import type { DateField, FieldComponentProps } from "../../types";

import { DEFAULT_DATE_FORMAT } from "@vef-framework-react/shared";
import DatePicker from "antd-mobile/es/components/date-picker";
import { useState } from "react";

import { EditorIcon } from "../../icons";
import { FieldShell } from "../../render/parts/field-shell";
import { formatTrigger, fromPickerDate, toPickerDate } from "./date-adapters";
import { PickerTrigger } from "./picker-trigger";
import { useMobileScopeContainer } from "./scope";

/**
 * Mobile renderer for the single-value date field. Mirrors the PC `date-field`
 * contract: same `FieldComponentProps<DateField, string>`, same `YYYY-MM-DD`
 * serialized value, same label / helper / error / required shell. Only the
 * control differs — a tappable trigger opening an antd-mobile `DatePicker` at
 * day precision rather than the antd desktop popover.
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

  const display = formatTrigger(value, DEFAULT_DATE_FORMAT);
  const placeholder = field.placeholder ?? "请选择日期";

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "日期"}
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

      <DatePicker
        getContainer={getContainer}
        precision="day"
        title={field.label ?? "日期"}
        value={toPickerDate(value)}
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={date => onChange(fromPickerDate(date, DEFAULT_DATE_FORMAT))}
      />
    </FieldShell>
  );
}
