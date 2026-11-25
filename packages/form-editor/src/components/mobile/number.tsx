import type { FC, KeyboardEvent } from "react";

import type { FieldComponentProps, NumberField } from "../../types";

import Input from "antd-mobile/es/components/input";
import { useEffect, useState } from "react";

import { FieldShell } from "../../render/parts/field-shell";
import { parseNumberDraft, useEntryCommit } from "../use-entry-commit";
import { InputCell, inputCellAffixCss } from "./input-cell";

/**
 * Mobile renderer for the number field, mirroring the PC `NumberInput` contract
 * (`components/number-field/index.tsx`): same `FieldComponentProps<NumberField,
 * number | undefined>` shape, same `min` / `max` / `step` / `placeholder`
 * honored, and the same label / helperText / errors / required / labelPosition
 * wiring through {@link FieldShell}, while sharing {@link parseNumberDraft} and
 * {@link useEntryCommit}.
 *
 * antd-mobile has no `InputNumber`, so the control is a `type="number"`
 * `Input`. A local `draft` string decouples the displayed text from the
 * committed numeric value, so intermediate states the user must type through —
 * a trailing "." ("1."), trailing zeros ("1.50"), a lone "-" — survive instead
 * of being collapsed by a Number()->String() round-trip on every keystroke.
 *
 * Range semantics vs the PC `InputNumber` (antd, `changeOnBlur` default):
 * both guarantee an out-of-range value is never committed and that the input
 * displays the clamped value after blur. They differ in *when* the clamped
 * commit happens — antd withholds `onChange` while the typed text is out of
 * range and commits the clamped value on blur; this control commits the
 * clamped value immediately per keystroke. Immediate clamping keeps the
 * draft ⇄ value reconcile guard below sound (the draft's commit result always
 * equals the committed value), which deferring the commit to blur would break.
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

  // Reconcile the draft when `value` changes from the outside (an external
  // reset or a `set_fields` linkage). The guard compares against what the draft
  // itself commits to, so an in-progress "-" / "1." / out-of-range "999" (which
  // commits to the same value) is never clobbered — only a genuinely different
  // incoming value re-seeds it.
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

  // Mirror antd InputNumber's blur reformat: once editing ends, the display
  // collapses to the canonical committed value ("999" → "10" with max 10,
  // "1.50" → "1.5", "-" → "").
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
