import type { FC } from "react";

import type { FieldComponentProps, RadioField } from "../../types";

import Radio from "antd-mobile/es/components/radio";

import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell } from "../../render/parts/field-shell";
import { MobileOptionGroup } from "./option-group";

/**
 * Mobile counterpart of `radio-field`. Mirrors `FieldComponentProps<RadioField,
 * string | number | undefined>` — the same scalar value contract as the PC
 * component — resolving options through the shared `useFieldOptions`. The
 * control differs only in surface: an antd-mobile `Radio.Group`, whose
 * `onChange(val)` already hands back the scalar option value, so no
 * normalization is needed beyond mapping `""` to `undefined` for the empty
 * state.
 */
export const MobileRadioInput: FC<FieldComponentProps<RadioField, string | number | undefined>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange
}) => {
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "单选"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <Radio.Group
        disabled={disabled}
        value={value === "" ? undefined : value}
        onChange={next => onChange(next)}
      >
        <MobileOptionGroup direction={field.direction} error={error} isEmpty={options.length === 0} loading={loading}>
          {options.map(option => (
            <Radio key={option.value} value={option.value}>
              {option.label}
            </Radio>
          ))}
        </MobileOptionGroup>
      </Radio.Group>
    </FieldShell>
  );
};
