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
  /**
   * Hide the label from assistive technology. For a control that carries the
   * same text as its own `aria-label` (the mobile switch, whose antd-mobile
   * element cannot be reached by `<label for>`), so the name is announced once
   * rather than twice.
   */
  "aria-hidden"?: boolean;
  children: ReactNode;
  htmlFor?: string;
  /**
   * DOM id, so a `role="group"` body can point back at this label. Used
   * instead of `htmlFor` for fields that render a set rather than one
   * labelable control.
   */
  id?: string;
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
  "aria-hidden": ariaHidden,
  children,
  htmlFor,
  id,
  position = "top",
  required,
  title
}: LabelProps): ReactElement {
  return (
    <label aria-hidden={ariaHidden} css={[labelCss, position === "top" && topGapCss]} htmlFor={htmlFor} id={id} title={title}>
      {children}
      {required ? <span aria-hidden="true" css={requiredMarkCss}>*</span> : null}
    </label>
  );
}
