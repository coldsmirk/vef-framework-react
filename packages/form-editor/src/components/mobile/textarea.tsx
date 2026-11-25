import type { FC } from "react";

import type { FieldComponentProps, TextareaField } from "../../types";

import TextArea from "antd-mobile/es/components/text-area";

import { FieldShell } from "../../render/parts/field-shell";
import { useEntryCommit } from "../use-entry-commit";
import { InputCell } from "./input-cell";

const DEFAULT_ROWS = 3;

export const MobileTextarea: FC<FieldComponentProps<TextareaField, string>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value = "",
  onChange,
  onCommit
}) => {
  const entryCommit = useEntryCommit({
    value,
    onCommit,
    commitOnEnter: false
  });

  const handleChange = (next: string): void => {
    entryCommit.notifyUserChange(next);
    onChange(next);
  };

  return (
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
          onBlur={() => entryCommit.handleBlur(value)}
          onChange={handleChange}
        />
      </InputCell>
    </FieldShell>
  );
};
