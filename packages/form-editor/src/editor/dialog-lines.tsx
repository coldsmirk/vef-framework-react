import type { ReactElement } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

const linesCss = css({
  margin: 0,
  paddingLeft: "1.2em",
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingXs,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.6,
  color: globalCssVars.colorTextSecondary,
  textAlign: "left"
});

const footnoteCss = css({
  listStyle: "none",
  marginTop: globalCssVars.spacingXs,
  color: globalCssVars.colorTextTertiary
});

export interface DialogLinesProps {
  /**
   * One plain-text statement per bullet. Callers keep the same array for the
   * dialog's `$vef`-less `detail`, so the two surfaces can never drift.
   */
  lines: string[];
  /**
   * Muted closing statement set apart from the bullets.
   */
  footnote?: string;
}

/**
 * Bulleted body for the editor's confirm / info dialogs.
 */
export function DialogLines({ footnote, lines }: DialogLinesProps): ReactElement {
  return (
    <ul css={linesCss}>
      {lines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
      {footnote === undefined ? null : <li css={footnoteCss}>{footnote}</li>}
    </ul>
  );
}

/**
 * Footnote for a destructive action the editor history can roll back.
 */
export const UNDOABLE_FOOTNOTE = "该操作可通过撤销恢复。";
