import type { FC } from "react";

import type { FieldComponentProps, TextfieldField } from "../../types";

import Input from "antd-mobile/es/components/input";

import { EditorIcon } from "../../icons";
import { FieldShell } from "../../render/parts/field-shell";
import { InputCell, inputCellAffixCss } from "./input-cell";

/**
 * Mobile renderer for the textfield, mirroring the PC `Textfield` contract
 * (`components/textfield/textfield.tsx`): same `FieldComponentProps<TextfieldField,
 * string>` shape, same label / helperText / errors / required / labelPosition
 * wiring through {@link FieldShell}. Only the control differs — an antd-mobile
 * `Input` (borderless by design, so it wears the shared {@link InputCell})
 * whose `onChange(string)` maps directly onto the field's string value.
 * antd-mobile's `Input` has no affix slot, so `prefixIcon` renders as a leading
 * cell adornment — the same pattern the mobile number field uses for its
 * `prefix` / `suffix` text.
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
      {field.prefixIcon
        ? (
            <span css={inputCellAffixCss}>
              <EditorIcon name={field.prefixIcon} />
            </span>
          )
        : null}

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
