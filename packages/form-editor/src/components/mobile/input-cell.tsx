import type { ReactElement, ReactNode } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

/**
 * The shared "input cell" look for mobile field controls — a full-width
 * bordered row on the container background, the mobile counterpart of the PC
 * bordered input. antd-mobile's bare `Input` / `TextArea` are intentionally
 * borderless (they expect to live inside an `adm-list` row); free-standing in
 * a form stack they read as missing controls, so every value-bearing mobile
 * control wraps in this cell instead. Single source shared by the free-text
 * fields (textfield / number / textarea) and {@link PickerTrigger}, so the two
 * families cannot drift apart visually.
 */
export const inputCellCss = css({
  display: "flex",
  alignItems: "stretch",
  gap: 8,
  width: "100%",
  minHeight: 40,
  padding: "0 12px",
  fontSize: globalCssVars.fontSize,
  lineHeight: 1.5,
  color: globalCssVars.colorText,
  background: globalCssVars.colorBgContainer,
  border: `1px solid ${globalCssVars.colorBorder}`,
  borderRadius: globalCssVars.borderRadius,
  transition: `border-color ${globalCssVars.motionDurationMid} ${globalCssVars.motionEaseOut}`,

  // Mirror the PC input's focus feedback. `:focus-within` so the ring follows
  // the inner control (adm input / textarea, or a trigger's opener button).
  "&:focus-within": {
    borderColor: globalCssVars.colorPrimary
  },

  // The adm control fills the cell; the cell owns border / background, so the
  // control's own (borderless) chrome disappears into it.
  "& .adm-input, & .adm-text-area": {
    flex: 1,
    minWidth: 0,
    "--font-size": globalCssVars.fontSize
  }
});

export const inputCellErrorCss = css({
  borderColor: globalCssVars.colorErrorBorder,

  "&:focus-within": {
    borderColor: globalCssVars.colorErrorBorder
  }
});

export const inputCellDisabledCss = css({
  color: globalCssVars.colorTextDisabled,
  background: globalCssVars.colorBgContainerDisabled
});

// A multi-line control needs vertical padding instead of the single-line
// cell's centering height.
const inputCellMultilineCss = css({
  padding: "8px 12px"
});

export interface InputCellProps {
  children: ReactNode;
  disabled?: boolean;
  hasError: boolean;
  /**
   * Pads the cell vertically for a multi-line control (textarea) instead of
   * relying on the single-line min-height centering.
   */
  multiline?: boolean;
}

/**
 * Bordered wrapper for a free-text mobile control. Presentational only — the
 * field component keeps full ownership of the control inside.
 */
export function InputCell({
  children,
  disabled = false,
  hasError,
  multiline = false
}: InputCellProps): ReactElement {
  return (
    <div
      css={[
        inputCellCss,
        multiline ? inputCellMultilineCss : undefined,
        hasError ? inputCellErrorCss : undefined,
        disabled ? inputCellDisabledCss : undefined
      ]}
    >
      {children}
    </div>
  );
}
