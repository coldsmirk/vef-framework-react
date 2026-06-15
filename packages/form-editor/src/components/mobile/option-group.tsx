import type { ReactElement, ReactNode } from "react";

import { css } from "@emotion/react";

import { OptionsStatus } from "../../render/parts/options-status";

// Hoisted so the layout style is not re-allocated on every keystroke-driven
// re-render (the prior per-call `groupCss(direction)` minted a fresh object each
// time); the two orientations are static.
const rowCss = css({
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8
});

const columnCss = css({
  display: "flex",
  flexDirection: "column",
  flexWrap: "wrap",
  gap: 8
});

export interface MobileOptionGroupProps {
  children: ReactNode;
  direction: "horizontal" | "vertical" | undefined;
  error: boolean;
  isEmpty: boolean;
  loading: boolean;
}

/**
 * Shared option-list body for the mobile radio / checkbox fields: the flex
 * row/column layout plus the loading / error / empty placeholder. The two fields
 * differ only in their antd-mobile group wrapper and the per-option control they
 * map, so everything below that wrapper lives here once. Reuses the same
 * {@link OptionsStatus} placeholder as the PC selection fields, so an empty,
 * loading, or failed source reads identically on both surfaces.
 */
export function MobileOptionGroup({
  children,
  direction,
  error,
  isEmpty,
  loading
}: MobileOptionGroupProps): ReactElement {
  return (
    <div css={direction === "horizontal" ? rowCss : columnCss}>
      {isEmpty ? <OptionsStatus error={error} loading={loading} /> : children}
    </div>
  );
}
