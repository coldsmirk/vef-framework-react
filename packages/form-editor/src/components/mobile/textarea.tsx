import type { FC } from "react";

import type { FieldComponentProps, TextareaField } from "../../types";

import TextArea from "antd-mobile/es/components/text-area";

import { FieldShell } from "../../render/parts/field-shell";
import { InputCell } from "./input-cell";

/**
 * Mobile renderer for the multi-line textarea, mirroring the PC `TextareaInput`
 * contract (`components/textarea-field/index.tsx`): same `FieldComponentProps<
 * TextareaField, string>` shape and the same label / helperText / errors /
 * required / labelPosition wiring through {@link FieldShell}. `rows` falls back to
 * the same default (3) the PC control uses. The antd-mobile `TextArea` already
 * hands `onChange` a string, so the field's string value maps over directly.
 */
const DEFAULT_ROWS = 3;

export const MobileTextarea: FC<FieldComponentProps<TextareaField, string>> = ({
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
    label={field.label ?? "多行文本"}
    labelPosition={field.labelPosition ?? labelPosition}
    required={required ?? field.validate?.required}
  >
    <InputCell multiline disabled={disabled} hasError={(errors?.length ?? 0) > 0}>
      <TextArea
        autoSize={field.autoSize}
        disabled={disabled}
        id={domId}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        rows={field.rows ?? DEFAULT_ROWS}
        showCount={field.showCount}
        value={value}
        onChange={onChange}
      />
    </InputCell>
  </FieldShell>
);
