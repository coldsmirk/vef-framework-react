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
  /**
   * How the label associates with what it names.
   *
   * `"control"` (the default) emits `<label for={domId}>`, which requires the
   * field to put `domId` on a LABELABLE element — an input, select, textarea or
   * button.
   *
   * `"group"` is for fields that render a set rather than a single control
   * (radio / checkbox groups, the upload dropzone, the code editor): `for` is
   * inert against their wrapper, so the label carries an id and the body
   * becomes a `role="group"` that points back at it. Without this the field has
   * NO accessible name — the reader announces the first option and nothing
   * about the question being asked.
   */
  labelledBy?: "control" | "group";
}

export function FieldShell({
  children,
  domId,
  errors,
  helperText,
  label,
  labelPosition = "top",
  labelledBy = "control",
  required
}: FieldShellProps): ReactElement {
  const labelTitle = typeof label === "string" ? label : undefined;
  const isGroup = labelledBy === "group";
  const labelId = `${domId}-label`;
  const labelNode = (
    <Label
      htmlFor={isGroup ? undefined : domId}
      id={isGroup ? labelId : undefined}
      position={labelPosition}
      required={required}
      title={labelTitle}
    >
      {label}
    </Label>
  );
  // TODO: thread `aria-describedby` to the control itself so the error text is
  // announced on focus as well as when it appears. That needs every field
  // renderer to accept the id, so it is a separate change from giving the
  // group-shaped fields a name at all.
  const body = isGroup
    ? (
        <div
          aria-invalid={errors !== undefined && errors.length > 0}
          aria-labelledby={labelId}
          aria-required={required}
          role="group"
        >
          {children}
        </div>
      )
    : children;

  if (labelPosition === "left" || labelPosition === "right") {
    return (
      <div css={stackCss}>
        <div css={rowCss}>
          <div css={[sideLabelCss, labelPosition === "right" ? sideLabelRightCss : undefined]}>
            {labelNode}
          </div>

          <div css={controlCss}>{body}</div>
        </div>

        <FieldFooter errors={errors} helperText={helperText} />
      </div>
    );
  }

  return (
    <div css={stackCss}>
      {labelNode}
      {body}
      <FieldFooter errors={errors} helperText={helperText} />
    </div>
  );
}
