import type { ReactElement } from "react";

import type { SubformRowChromeProps } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

/**
 * Shared chrome styling and row surface for subforms and section collapse,
 * identical across the PC and mobile container chrome sets. Both render the
 * same token-driven row surface (the visual contract is device-independent),
 * so the styles and row component live once here instead of being copied per
 * device module.
 */

export const subformBodyCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 12
});

const subformRowCss = css({
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: 12,
  borderRadius: globalCssVars.borderRadius,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const subformRowCardCss = css({
  display: "flex",
  flexDirection: "column",
  borderRadius: globalCssVars.borderRadius,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  overflow: "hidden"
});

const subformRowHeaderCss = css({
  padding: "8px 12px",
  background: globalCssVars.colorFillQuaternary,
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  color: globalCssVars.colorTextHeading,
  fontWeight: globalCssVars.fontWeightStrong,
  lineHeight: 1.5,
  wordBreak: "break-word"
});

const subformRowCardBodyCss = css({
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: 12
});

const subformRowBodyCss = css({
  flex: 1,
  minWidth: 0
});

export const subformRemoveCss = css({
  flexShrink: 0
});

/**
 * Shared subform row surface used by both PC and mobile container chrome:
 * renders a plain bordered row for dynamic subforms and a titled card when
 * `header` is provided (fixed-row stack / mobile checklist items).
 */
export function SharedSubformRow({
  children,
  header,
  removeControl
}: SubformRowChromeProps): ReactElement {
  if (header !== undefined) {
    return (
      <div css={subformRowCardCss}>
        <div css={subformRowHeaderCss}>{header}</div>

        <div css={subformRowCardBodyCss}>
          <div css={subformRowBodyCss}>{children}</div>
          {removeControl}
        </div>
      </div>
    );
  }

  return (
    <div css={subformRowCss}>
      <div css={subformRowBodyCss}>{children}</div>
      {removeControl}
    </div>
  );
}

/**
 * The single-item collapse key used by the `collapse` Section variant. Local to
 * each `Section` instance, so a stable literal is enough — `defaultActiveKey`
 * only has to match this item's `key`.
 */
export const SECTION_PANEL_KEY = "panel";
