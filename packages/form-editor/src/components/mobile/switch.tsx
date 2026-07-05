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
 * `id`, so the inline label is presentational while the control stays
 * accessible via its own `aria-checked`. `onChange(checked)` maps directly
 * onto the field's boolean value.
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
        checked={value === true}
        checkedText={field.onText}
        disabled={disabled}
        uncheckedText={field.offText}
        onChange={onChange}
      />

      {/* Same contract as the PC control: SwitchField has no static required
          toggle, so `required` only arrives from a runtime `require` linkage —
          the marker must track it like every other field. */}
      <Label position="right" required={required}>
        {field.label ?? "开关"}
      </Label>
    </div>

    <FieldFooter errors={errors} helperText={field.helperText} />
  </div>
);
