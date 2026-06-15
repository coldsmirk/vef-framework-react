import type { FC } from "react";

import type { FieldComponentProps, TextfieldField } from "../../types";

import Input from "antd-mobile/es/components/input";

import { FieldShell } from "../../render/parts/field-shell";
import { InputCell } from "./input-cell";

/**
 * Mobile renderer for the textfield, mirroring the PC `Textfield` contract
 * (`components/textfield/textfield.tsx`): same `FieldComponentProps<TextfieldField,
 * string>` shape, same label / helperText / errors / required / labelPosition
 * wiring through {@link FieldShell}. Only the control differs — an antd-mobile
 * `Input` (borderless by design, so it wears the shared {@link InputCell})
 * whose `onChange(string)` maps directly onto the field's string value.
 */
export const MobileTextfield: FC<FieldComponentProps<TextfieldField, string>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value = "",
  onChange
}) => (
  <FieldShell
    domId={domId}
    errors={errors}
    helperText={field.helperText}
    label={field.label ?? "文本框"}
    labelPosition={field.labelPosition ?? labelPosition}
    required={required ?? field.validate?.required}
  >
    <InputCell disabled={disabled} hasError={(errors?.length ?? 0) > 0}>
      <Input
        clearable={field.allowClear}
        disabled={disabled}
        id={domId}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        type={field.inputType}
        value={value}
        onChange={onChange}
      />
    </InputCell>
  </FieldShell>
);
