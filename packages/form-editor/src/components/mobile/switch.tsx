import type { FC } from "react";

import type { FieldComponentProps, SwitchField } from "../../types";

import Switch from "antd-mobile/es/components/switch";

import { FieldShell } from "../../render/parts/field-shell";

/**
 * Mobile renderer for the switch field. Stores the same `boolean` value the PC
 * `SwitchInput` does (`components/switch-field/index.tsx`) and honors the same
 * `label` / `helperText`. Unlike the PC control it routes label / helper / errors
 * through the shared {@link FieldShell} so the mobile leaf fields stay uniform.
 *
 * antd-mobile's `Switch` renders a `role="switch"` element (no labelable `id`),
 * so the FieldShell label is presentational here while the control stays
 * accessible via its own `aria-checked`. `onChange(checked)` maps directly onto
 * the field's boolean value.
 */
export const MobileSwitch: FC<FieldComponentProps<SwitchField, boolean>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange
}) => (
  <FieldShell
    domId={domId}
    errors={errors}
    helperText={field.helperText}
    label={field.label ?? "开关"}
    labelPosition={field.labelPosition ?? labelPosition}
    required={required}
  >
    <Switch
      checked={value === true}
      checkedText={field.onText}
      disabled={disabled}
      uncheckedText={field.offText}
      onChange={onChange}
    />
  </FieldShell>
);
