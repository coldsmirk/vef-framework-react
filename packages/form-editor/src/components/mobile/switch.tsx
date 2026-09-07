import type { FC } from "react";

import type { FieldComponentProps, SwitchField } from "../../types";

import { css } from "@emotion/react";
import Switch from "antd-mobile/es/components/switch";

import { FieldFooter } from "../../render/parts/field-shell";
import { Label } from "../../render/parts/label";

const wrapperCss = css({
  display: "flex",
  flexDirection: "column",
  width: "100%"
});

const rowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 10
});

/**
 * Mobile renderer for the switch field. Stores the same `boolean` value and
 * mirrors the PC `SwitchInput` layout (`components/switch-field/index.tsx`):
 * the label sits inline to the toggle's right — a switch is not an input-like
 * field, so it does not use {@link FieldShell} (whose label-column layouts are
 * built for text-style controls) on either device.
 *
 * antd-mobile's `Switch` renders a `role="switch"` element with no labelable
 * `id`, so `<label for>` cannot reach it and the inline label is presentational.
 * The control is therefore named directly with `aria-label` (antd-mobile's
 * `NativeProps` forwards `AriaAttributes`) — `aria-checked` alone is a STATE,
 * and without a name a reader announces every switch on the form identically.
 * `onChange(checked)` maps directly onto the field's boolean value.
 */
export const MobileSwitch: FC<FieldComponentProps<SwitchField, boolean>> = ({
  disabled,
  errors,
  field,
  required,
  value,
  onChange
}) => (
  <div css={wrapperCss}>
    <div css={rowCss}>
      <Switch
        aria-label={switchLabel(field)}
        aria-required={required}
        checked={value === true}
        checkedText={field.onText}
        disabled={disabled}
        uncheckedText={field.offText}
        onChange={onChange}
      />

      {/* Same contract as the PC control: SwitchField has no static required
          toggle, so `required` only arrives from a runtime `require` linkage —
          the marker must track it like every other field. */}
      {/* aria-hidden: the control already carries this text as its accessible
          name, so exposing the label too would announce it twice. */}
      <Label aria-hidden position="right" required={required}>
        {switchLabel(field)}
      </Label>
    </div>

    <FieldFooter errors={errors} helperText={field.helperText} />
  </div>
);

function switchLabel(field: SwitchField): string {
  return field.label ?? "开关";
}
