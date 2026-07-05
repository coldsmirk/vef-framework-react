import type { FC } from "react";

import type { FieldComponentProps, NumberField } from "../../types";

import { isNullish } from "@vef-framework-react/shared";
import Input from "antd-mobile/es/components/input";
import { useEffect, useState } from "react";

import { FieldShell } from "../../render/parts/field-shell";
import { InputCell, inputCellAffixCss } from "./input-cell";

/**
 * Parse a raw input string to the field's committed numeric value, the single
 * source of truth for what a draft "commits" to: an empty entry or a
 * non-numeric intermediate (`NaN`) clears to `undefined` (never `""`), and a
 * parseable number is clamped into the field's `min` / `max` bounds so an
 * out-of-range value can never be committed. When `precision` is set the clamped
 * value is rounded to that many decimals *after* clamping, so the rounded result
 * still respects the bounds.
 */
function parseDraft(
  raw: string,
  min: number | undefined,
  max: number | undefined,
  precision: number | undefined
): number | undefined {
  const next = Number(raw);

  if (raw.trim() === "" || Number.isNaN(next)) {
    return undefined;
  }

  const clamped = Math.min(Math.max(next, min ?? -Infinity), max ?? Infinity);

  if (isNullish(precision)) {
    return clamped;
  }

  // `toFixed` throws a RangeError outside 0..100; the property entry clamps
  // new writes, but a hand-authored schema can still carry an out-of-range
  // precision — clamp here so a bad value degrades instead of crashing render.
  const digits = Math.min(100, Math.max(0, Math.floor(precision)));

  return Number(clamped.toFixed(digits));
}

/**
 * Mobile renderer for the number field, mirroring the PC `NumberInput` contract
 * (`components/number-field/index.tsx`): same `FieldComponentProps<NumberField,
 * number | undefined>` shape, same `min` / `max` / `step` / `placeholder` honored,
 * and the same label / helperText / errors / required / labelPosition wiring
 * through {@link FieldShell}.
 *
 * antd-mobile has no `InputNumber`, so the control is a `type="number"` `Input`.
 * A local `draft` string decouples the displayed text from the committed numeric
 * value, so intermediate states the user must type through — a trailing "."
 * ("1."), trailing zeros ("1.50"), a lone "-" — survive instead of being
 * collapsed by a Number()->String() round-trip on every keystroke.
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
  onChange
}) => {
  const [draft, setDraft] = useState(() => value === undefined ? "" : String(value));

  // Reconcile the draft when `value` changes from the outside (an external reset
  // or a `set_field` linkage). The guard compares against what the draft itself
  // commits to, so an in-progress "-" / "1." / out-of-range "999" (which commits
  // to the same value) is never clobbered — only a genuinely different incoming
  // value re-seeds it.
  useEffect(() => {
    if (parseDraft(draft, field.min, field.max, field.precision) !== value) {
      setDraft(value === undefined ? "" : String(value));
    }
  }, [value, draft, field.min, field.max, field.precision]);

  const handleChange = (raw: string): void => {
    setDraft(raw);
    onChange(parseDraft(raw, field.min, field.max, field.precision));
  };

  // Mirror antd InputNumber's blur reformat: once editing ends, the display
  // collapses to the canonical committed value ("999" → "10" with max 10,
  // "1.50" → "1.5", "-" → "").
  const handleBlur = (): void => {
    const committed = parseDraft(draft, field.min, field.max, field.precision);

    setDraft(committed === undefined ? "" : String(committed));
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
          id={domId}
          max={field.max}
          min={field.min}
          placeholder={field.placeholder}
          step={field.step}
          type="number"
          value={draft}
          onBlur={handleBlur}
          onChange={handleChange}
        />

        {field.suffix ? <span css={inputCellAffixCss}>{field.suffix}</span> : null}
      </InputCell>
    </FieldShell>
  );
};
