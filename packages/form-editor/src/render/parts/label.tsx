import type { ReactElement, ReactNode } from "react";

import type { LabelPosition } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

const labelCss = css({
  display: "inline-block",
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  lineHeight: globalCssVars.lineHeight,
  color: globalCssVars.colorText
});

/**
 * Bottom gap only when the label sits above its control. Left/right placements
 * lay the label beside the control, where a bottom margin would misalign it.
 */
const topGapCss = css({ marginBottom: 6 });

const requiredMarkCss = css({
  marginLeft: 3,
  color: globalCssVars.colorErrorText,
  fontWeight: 600
});

export interface LabelProps {
  children: ReactNode;
  htmlFor?: string;
  position?: LabelPosition;
  required?: boolean;
  /**
   * Native tooltip text, surfaced when a fixed-width side label truncates its
   * text to a single line. Top labels pass it too (harmless) so the full label
   * is always discoverable on hover.
   */
  title?: string;
}

/**
 * Reusable form field label with an optional red asterisk for required fields.
 * `position` only affects its own spacing; the surrounding {@link FieldShell}
 * owns the label-vs-control axis.
 */
export function Label({
  children,
  htmlFor,
  position = "top",
  required,
  title
}: LabelProps): ReactElement {
  return (
    <label css={[labelCss, position === "top" && topGapCss]} htmlFor={htmlFor} title={title}>
      {children}
      {required ? <span aria-hidden="true" css={requiredMarkCss}>*</span> : null}
    </label>
  );
}
