import type { ReactElement, ReactNode } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { EditorIcon } from "../../icons";
import { inputCellCss, inputCellDisabledCss, inputCellErrorCss } from "./input-cell";

/**
 * Tappable trigger shared by the mobile date / datetime / daterange and select
 * fields. Wears the shared {@link inputCellCss}, so it reads exactly like the
 * free-text input cells — a full-width bordered row whose text shows the
 * formatted value or, when empty, the placeholder in the muted weak color.
 * Errors flip the border to the danger color, mirroring the PC
 * `status="error"` treatment.
 *
 * The cell is a wrapper around two real buttons — the opener and the optional
 * clear affordance — because a button cannot nest inside a button.
 */

// The opener fills the cell and inherits its typography; the cell wrapper owns
// the border / background so the trailing affordances sit inside the field.
const openButtonCss = css({
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  padding: 0,
  border: "none",
  background: "transparent",
  textAlign: "left",
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  "&:disabled": {
    cursor: "not-allowed",
    color: "inherit"
  }
});

const triggerPlaceholderCss = css({
  color: globalCssVars.colorTextPlaceholder
});

// Value text fills the row and truncates, so an optional trailing element (e.g.
// the select caret or the clear affordance) stays pinned to the right edge.
const triggerValueCss = css({
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const clearButtonCss = css({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  padding: 0,
  border: "none",
  background: "transparent",
  color: globalCssVars.colorTextTertiary,
  cursor: "pointer",

  "& > svg": {
    width: 16,
    height: 16
  },

  "&:hover": {
    color: globalCssVars.colorTextSecondary
  },

  // Touch has no hover, so press feedback is the only cue there; and a keyboard
  // user needs a focus ring. The cell is borderless/tight, so use an outline
  // (zero offset, no layout shift / clipping) rather than a border.
  "&:active": {
    color: globalCssVars.colorText
  },

  "&:focus-visible": {
    outline: `2px solid ${globalCssVars.colorPrimary}`,
    outlineOffset: 0,
    borderRadius: globalCssVars.borderRadiusSm
  }
});

// The trailing slot always holds an icon (the select caret, a date/calendar
// glyph): own the lucide sizing + tint here, mirroring `clearButtonCss`, so every
// trigger's affordance reads at one consistent weight instead of each caller
// re-stating it.
const trailingCss = css({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  color: globalCssVars.colorTextTertiary,

  "& > svg": {
    width: 16,
    height: 16
  }
});

export interface PickerTriggerProps {
  /**
   * Formatted value to show; falls back to {@link PickerTriggerProps.placeholder} when empty.
   */
  display: string;
  placeholder: string;
  domId: string;
  disabled?: boolean;
  hasError: boolean;
  /**
   * Optional element pinned to the trailing edge (e.g. a dropdown caret). Stays
   * visible alongside the clear affordance — the clear sits beside it, never
   * replaces it, so the caret keeps signalling that the cell opens a picker.
   */
  trailing?: ReactNode;
  onOpen: () => void;
  /**
   * Clear handler. When provided, a trailing clear affordance shows whenever a
   * value is displayed (and the field is enabled), so an optional field is
   * never permanently filled once set — mirroring the PC pickers' clear icon.
   * The owner commits its own empty value shape (`""` / `[]`).
   */
  onClear?: () => void;
}

/**
 * The tappable cell that opens a mobile picker. Presentational only — the owner
 * holds the picker's `visible` state and passes {@link PickerTriggerProps.onOpen}.
 * Shared by the date / datetime / daterange fields and the select field.
 */
export function PickerTrigger({
  disabled,
  display,
  domId,
  hasError,
  onClear,
  onOpen,
  placeholder,
  trailing
}: PickerTriggerProps): ReactElement {
  const showClear = onClear !== undefined && !disabled && display !== "";

  return (
    <div
      css={[
        inputCellCss,
        hasError ? inputCellErrorCss : undefined,
        disabled ? inputCellDisabledCss : undefined
      ]}
    >
      <button
        css={openButtonCss}
        disabled={disabled}
        id={domId}
        type="button"
        onClick={onOpen}
      >
        <span css={triggerValueCss}>
          {display || <span css={triggerPlaceholderCss}>{placeholder}</span>}
        </span>
      </button>

      {/* Caret and clear coexist as independent siblings: the caret is the
          affordance that says "this opens a picker", so it must not vanish the
          moment a value is set (the clear sits beside it instead of replacing
          it). */}
      {trailing ? <span css={trailingCss}>{trailing}</span> : null}

      {showClear
        ? (
            <button aria-label="清除" css={clearButtonCss} type="button" onClick={onClear}>
              <EditorIcon name="circle-x" />
            </button>
          )
        : null}
    </div>
  );
}
