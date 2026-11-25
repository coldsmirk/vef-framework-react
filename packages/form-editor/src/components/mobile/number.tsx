import type { FC, KeyboardEvent } from "react";

import type { FieldComponentProps, NumberField } from "../../types";

import Input from "antd-mobile/es/components/input";
import { useEffect, useState } from "react";

import { FieldShell } from "../../render/parts/field-shell";
import { parseNumberDraft, useEntryCommit } from "../use-entry-commit";
import { InputCell, inputCellAffixCss } from "./input-cell";

/**
 * Mobile renderer for the number field, mirroring the PC `NumberInput` contract
 * and sharing {@link parseNumberDraft} and {@link useEntryCommit}.
 */
export const MobileNumber: FC<FieldComponentProps<NumberField, number | undefined>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange,
  onCommit
}) => {
  const [draft, setDraft] = useState(() => value === undefined ? "" : String(value));
  const entryCommit = useEntryCommit({
    value,
    onCommit,
    commitOnEnter: true
  });

  useEffect(() => {
    if (parseNumberDraft(draft, field.min, field.max, field.precision) !== value) {
      setDraft(value === undefined ? "" : String(value));
    }
  }, [value, draft, field.min, field.max, field.precision]);

  const handleChange = (raw: string): void => {
    const next = parseNumberDraft(raw, field.min, field.max, field.precision);

    setDraft(raw);
    entryCommit.notifyUserChange(next);
    onChange(next);
  };

  const flushDraft = (): number | undefined => {
    const committed = parseNumberDraft(draft, field.min, field.max, field.precision);

    setDraft(committed === undefined ? "" : String(committed));

    if (!Object.is(committed, value)) {
      entryCommit.notifyUserChange(committed);
      onChange(committed);
    }

    return committed;
  };

  const handleBlur = (): void => {
    const committed = flushDraft();

    entryCommit.handleBlur(committed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (!onCommit || event.key !== "Enter" || entryCommit.isComposing(event)) {
      return;
    }

    event.preventDefault();
    const committed = flushDraft();

    entryCommit.commitNow(committed);
  };

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "数字"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <InputCell disabled={disabled} hasError={(errors?.length ?? 0) > 0}>
        {field.prefix ? <span css={inputCellAffixCss}>{field.prefix}</span> : null}

        <Input
          disabled={disabled}
          enterKeyHint={onCommit ? "done" : undefined}
          id={domId}
          max={field.max}
          min={field.min}
          placeholder={field.placeholder}
          step={field.step}
          type="number"
          value={draft}
          onBlur={handleBlur}
          onChange={handleChange}
          onCompositionEnd={entryCommit.handleCompositionEnd}
          onCompositionStart={entryCommit.handleCompositionStart}
          onKeyDown={handleKeyDown}
        />

        {field.suffix ? <span css={inputCellAffixCss}>{field.suffix}</span> : null}
      </InputCell>
    </FieldShell>
  );
};
