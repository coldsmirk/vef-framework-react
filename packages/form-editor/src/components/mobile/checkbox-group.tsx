import type { FC } from "react";

import type { CheckboxGroupField, FieldComponentProps } from "../../types";

import Checkbox from "antd-mobile/es/components/checkbox";

import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell } from "../../render/parts/field-shell";
import { MobileOptionGroup } from "./option-group";

/**
 * Mobile counterpart of `checkbox-group-field`. Mirrors
 * `FieldComponentProps<CheckboxGroupField, Array<string | number>>` — the same
 * array value contract as the PC component — resolving options through the
 * shared `useFieldOptions`. The control differs only in surface: an
 * antd-mobile `Checkbox.Group`, whose `value` and `onChange(val)` already use
 * `Array<string | number>`, so the value flows through without normalization.
 */
export const MobileCheckboxGroupInput: FC<FieldComponentProps<CheckboxGroupField, Array<string | number>>> = ({
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
      label={field.label ?? "多选"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <Checkbox.Group
        disabled={disabled}
        value={Array.isArray(value) ? value : []}
        onChange={next => onChange(next)}
      >
        <MobileOptionGroup direction={field.direction} error={error} isEmpty={options.length === 0} loading={loading}>
          {options.map(option => (
            <Checkbox key={option.value} value={option.value}>
              {option.label}
            </Checkbox>
          ))}
        </MobileOptionGroup>
      </Checkbox.Group>
    </FieldShell>
  );
};
