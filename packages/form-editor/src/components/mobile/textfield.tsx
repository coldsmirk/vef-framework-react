import type { FC } from "react";

import type { FieldComponentProps, TextfieldField } from "../../types";

import Input from "antd-mobile/es/components/input";

import { EditorIcon } from "../../icons";
import { FieldShell } from "../../render/parts/field-shell";
import { useEntryCommit } from "../use-entry-commit";
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
 * `prefix` / `suffix` text. Wires `"entry"` commit semantics (IME-safe Enter +
 * dirty blur) and sets `enterKeyHint="done"` when a `commit` trigger is
 * configured.
 */
export const MobileTextfield: FC<FieldComponentProps<TextfieldField, string>> = ({
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
    commitOnEnter: true
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
          enterKeyHint={onCommit ? "done" : undefined}
          id={domId}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          type={field.inputType}
          value={value}
          onBlur={() => entryCommit.handleBlur(value)}
          onChange={handleChange}
          onCompositionEnd={entryCommit.handleCompositionEnd}
          onCompositionStart={entryCommit.handleCompositionStart}
          onKeyDown={event => entryCommit.handleKeyDown(event, value)}
        />
      </InputCell>
    </FieldShell>
  );
};
