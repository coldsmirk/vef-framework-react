import type { ReactElement, ReactNode } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

const wrapperCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6
});

/**
 * The label token for a property entry. Exported so the option-source entry —
 * whose own `<div>`-based layout cannot use {@link EntryField} — keeps the same
 * label styling instead of drifting its own copy.
 */
export const entryLabelCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary,
  letterSpacing: 0
});

/**
 * The description token for a property entry. Exported alongside
 * {@link entryLabelCss} so the option-source entry — whose own `<div>`-based
 * layout cannot use {@link EntryField} — renders its optional `description` with
 * the same styling instead of dropping it.
 */
export const descriptionCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.4
});

export interface EntryFieldProps {
  label: string;
  description?: string;
  children: ReactNode;
}

/**
 * Shared chrome for a labelled property entry: a native `<label>` wrapping the
 * entry label, the control (`children`), and an optional description below. Each
 * input entry renderer (`text` / `number` / `select` / `icon`) provides only its
 * control — mirroring the runtime `FieldShell` split — so the label / spacing /
 * description tokens live in one place. The `<label>` wrapper keeps the
 * click-to-focus behavior those single-control entries rely on.
 */
export function EntryField({
  children,
  description,
  label
}: EntryFieldProps): ReactElement {
  return (
    <label css={wrapperCss}>
      <span css={entryLabelCss}>{label}</span>
      {children}
      {description ? <span css={descriptionCss}>{description}</span> : null}
    </label>
  );
}
