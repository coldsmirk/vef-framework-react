import type { ReactElement, ReactNode } from "react";

import type { LabelPosition } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { Label } from "./label";

/**
 * Shared layout shell for input-like leaf fields (textfield / number / code
 * editor). Owns the label-vs-control arrangement so each field renderer only
 * provides its control, and the `labelPosition` axis is implemented once.
 *
 * - `top` (default): label above the control.
 * - `left` / `right`: label in a fixed-width column beside the control, with
 * helper text and errors spanning the full width underneath.
 */

const stackCss = css({
  display: "flex",
  flexDirection: "column",
  width: "100%"
});

const rowCss = css({
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  width: "100%"
});

const sideLabelCss = css({
  flexShrink: 0,
  width: 96,
  paddingTop: 6,
  overflow: "hidden",
  // A label longer than the fixed column truncates with an ellipsis instead of
  // wrapping to a second line (which breaks the row's baseline alignment); the
  // full text stays available through the `title` tooltip the shell sets for
  // plain-string labels.
  "& > label": {
    display: "block",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis"
  }
});

const sideLabelRightCss = css({ textAlign: "right" });

const controlCss = css({
  flex: 1,
  minWidth: 0
});

/**
 * Secondary text scales, exported so switch-field (which lays its label inline
 * and cannot use FieldShell) shares the exact token set instead of re-hardcoding
 * `fontSize: 12` / a divergent error style. Helper and error share one small
 * scale so the footer band reads as one type level.
 */
export const helperTextCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.5
});

export const errorTextCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorErrorText,
  lineHeight: 1.5
});

const footerSpacingCss = css({ marginTop: 4 });

export interface FieldFooterProps {
  errors?: string[];
  helperText?: string;
}

/**
 * The helper-text + error band shared by {@link FieldShell} and the switch field
 * (which lays its label inline and so cannot use FieldShell). Centralizes the
 * small-scale token set, the `errors.join("、")` separator, and the `role="alert"`
 * contract so the two paths can never drift. Renders nothing when there is neither
 * helper text nor an error.
 */
export function FieldFooter({ errors, helperText }: FieldFooterProps): ReactElement | null {
  if (!helperText && !errors?.length) {
    return null;
  }

  return (
    <>
      {helperText ? <span css={[helperTextCss, footerSpacingCss]}>{helperText}</span> : null}
      {errors?.length ? <div css={[errorTextCss, footerSpacingCss]} role="alert">{errors.join("、")}</div> : null}
    </>
  );
}

export interface FieldShellProps {
  children: ReactNode;
  domId: string;
  errors?: string[];
  helperText?: string;
  label: ReactNode;
  labelPosition?: LabelPosition;
  required?: boolean;
}

export function FieldShell({
  children,
  domId,
  errors,
  helperText,
  label,
  labelPosition = "top",
  required
}: FieldShellProps): ReactElement {
  const labelTitle = typeof label === "string" ? label : undefined;
  const labelNode = (
    <Label htmlFor={domId} position={labelPosition} required={required} title={labelTitle}>
      {label}
    </Label>
  );

  if (labelPosition === "left" || labelPosition === "right") {
    return (
      <div css={stackCss}>
        <div css={rowCss}>
          <div css={[sideLabelCss, labelPosition === "right" ? sideLabelRightCss : undefined]}>
            {labelNode}
          </div>

          <div css={controlCss}>{children}</div>
        </div>

        <FieldFooter errors={errors} helperText={helperText} />
      </div>
    );
  }

  return (
    <div css={stackCss}>
      {labelNode}
      {children}
      <FieldFooter errors={errors} helperText={helperText} />
    </div>
  );
}
