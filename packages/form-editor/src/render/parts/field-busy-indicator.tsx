import type { ReactElement } from "react";

import { css, keyframes } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { useFieldBusy } from "../../runtime/effects";

const spin = keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" }
});

const overlayWrapCss = css({
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  zIndex: 2
});

const inlineWrapCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  pointerEvents: "none"
});

const spinnerCss = css({
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: `2px solid ${globalCssVars.colorBorderSecondary}`,
  borderTopColor: globalCssVars.colorPrimary,
  animation: `${spin} 0.7s linear infinite`
});

/**
 * Subtle busy spinner rendered for the enclosing field while one of its own
 * effect sequences has an in-flight `api_call`. Subscribes directly to the
 * sequence controller via {@link useFieldBusy} so toggling busy state never
 * re-renders the field's control or shell.
 *
 * Defaults to an absolute-positioned right-inset overlay (0px geometry
 * footprint — zero layout shift across PC inputs, mobile inputs, and table
 * cells). Pass `inline` for non-box inline controls such as `Switch`.
 */
export function FieldBusyIndicator({ inline = false }: { inline?: boolean }): ReactElement | null {
  const busy = useFieldBusy();

  if (!busy) {
    return null;
  }

  return (
    <span
      aria-label="加载中"
      css={inline ? inlineWrapCss : overlayWrapCss}
      data-field-busy="true"
      role="status"
    >
      <span aria-hidden="true" css={spinnerCss} />
    </span>
  );
}
