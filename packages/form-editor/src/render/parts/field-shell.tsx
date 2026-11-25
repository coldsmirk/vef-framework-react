import type { ReactElement, ReactNode } from "react";

import type { LabelPosition } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { createContext, use } from "react";

import { FieldBusyIndicator } from "./field-busy-indicator";
import { Label } from "./label";

/**
 * Presentation context provided by each table-subform cell so leaf field
 * renderers reuse the exact same components as stacked forms while omitting
 * redundant per-cell labels/helper text and rendering jump-free cell validation
 * feedback.
 */
export interface FieldCellContextValue {
  /**
   * DOM id of the column header text element this cell belongs to, wired to
   * `aria-labelledby` so controls keep an accessible name without duplicating
   * the column title text inside every cell.
   */
  labelId: string;
}

const FieldCellContext = createContext<FieldCellContextValue | null>(null);
FieldCellContext.displayName = "FormEditorFieldCellContext";

export function FieldCellProvider({
  children,
  value
}: {
  children: ReactNode;
  value: FieldCellContextValue;
}): ReactElement {
  return <FieldCellContext value={value}>{children}</FieldCellContext>;
}

export function useFieldCell(): FieldCellContextValue | null {
  return use(FieldCellContext);
}

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

const topLabelRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 6,

  // The row owns the 6px bottom gap so the inline busy spinner stays vertically
  // centered on the label baseline with zero height shift.
  "& > label": {
    marginBottom: 0
  }
});

const sideLabelCss = css({
  flexShrink: 0,
  width: 96,
  paddingTop: 6,
  overflow: "hidden"
});

const sideLabelInnerCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  maxWidth: "100%",
  // A label longer than the fixed column truncates with an ellipsis instead of
  // wrapping to a second line (which breaks the row's baseline alignment); the
  // full text stays available through the `title` tooltip the shell sets for
  // plain-string labels.
  "& > label": {
    display: "block",
    minWidth: 0,
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

// Reserved bottom slot inside table cells: errors land at `bottom: 0` inside
// this padding so transitioning valid ⇄ invalid never shifts row height.
const cellFieldCss = css({
  position: "relative",
  width: "100%",
  paddingBottom: 18
});

// Permanent 1px transparent border around controls without antd `status="error"`
// support (Radio.Group, Checkbox.Group, Switch, Upload), flipping to error
// color with zero geometry shift.
const cellOutlinedCss = css({
  display: "flex",
  alignItems: "center",
  width: "100%",
  minHeight: 32,
  padding: "2px 6px",
  borderRadius: globalCssVars.borderRadius,
  border: "1px solid transparent",
  transition: "border-color 0.2s, background-color 0.2s"
});

const cellOutlinedErrorCss = css({
  borderColor: globalCssVars.colorError,
  backgroundColor: globalCssVars.colorErrorBg
});

const cellStatusCss = css({
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 16,
  display: "flex",
  alignItems: "center",
  gap: 4,
  pointerEvents: "none"
});

const cellErrorCss = css({
  minWidth: 0,
  flex: 1,
  fontSize: 11,
  lineHeight: "16px",
  color: globalCssVars.colorErrorText,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
});

export interface CellFieldFrameProps {
  children: ReactNode;
  errors?: string[];
  /**
   * Wrap the control in a border-ready box that highlights in red when invalid
   * (for controls that do not accept antd's `status="error"` prop).
   */
  outlined?: boolean;
  /**
   * Optional ARIA group metadata applied to the outlined wrapper for
   * multi-control widgets (`labelledBy="group"`).
   */
  groupProps?: {
    "aria-invalid": boolean;
    "aria-labelledby": string;
    "aria-required"?: boolean;
  };
}

/**
 * Shared table-cell frame for {@link FieldShell} and inline controls like
 * `SwitchInput`. Keeps row height constant across validation state changes by
 * placing the single-line error message inside a fixed bottom slot, with full
 * text surfaced via `title` when truncated in narrow columns.
 */
export function CellFieldFrame({
  children,
  errors,
  groupProps,
  outlined = false
}: CellFieldFrameProps): ReactElement {
  const hasError = errors !== undefined && errors.length > 0;
  const errorMessage = hasError ? errors.join("、") : undefined;

  return (
    <div css={cellFieldCss}>
      {outlined || groupProps
        ? (
            <div
              {...groupProps}
              css={[cellOutlinedCss, hasError && cellOutlinedErrorCss]}
              role={groupProps ? "group" : undefined}
            >
              {children}
            </div>
          )
        : children}

      <div css={cellStatusCss}>
        <FieldBusyIndicator />

        {errorMessage
          ? (
              <span css={cellErrorCss} role="alert" title={errorMessage}>
                {errorMessage}
              </span>
            )
          : null}
      </div>
    </div>
  );
}

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
  const cell = useFieldCell();
  const isGroup = labelledBy === "group";

  if (cell !== null) {
    return (
      <CellFieldFrame
        errors={errors}
        outlined={isGroup}
        groupProps={isGroup
          ? {
              "aria-invalid": errors !== undefined && errors.length > 0,
              "aria-labelledby": cell.labelId,
              "aria-required": required
            }
          : undefined}
      >
        {children}
      </CellFieldFrame>
    );
  }

  const labelTitle = typeof label === "string" ? label : undefined;
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
      <div css={stackCss} data-field-shell="">
        <div css={rowCss}>
          <div css={[sideLabelCss, labelPosition === "right" ? sideLabelRightCss : undefined]}>
            <span css={sideLabelInnerCss}>
              {labelNode}
              <FieldBusyIndicator />
            </span>
          </div>

          <div css={controlCss}>{body}</div>
        </div>

        <FieldFooter errors={errors} helperText={helperText} />
      </div>
    );
  }

  return (
    <div css={stackCss} data-field-shell="">
      <div css={topLabelRowCss}>
        {labelNode}
        <FieldBusyIndicator />
      </div>

      {body}
      <FieldFooter errors={errors} helperText={helperText} />
    </div>
  );
}
