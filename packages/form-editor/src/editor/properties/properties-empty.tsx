import type { DynamicIconName } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { EditorIcon } from "../../icons";

const wrapperCss = css({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  padding: "48px 24px",
  textAlign: "center"
});

const iconCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 56,
  height: 56,
  borderRadius: "50%",
  // A quiet neutral chip — the rarely-seen "nothing selected" screen should not
  // be the flashiest thing in the tool, so the accent stays reserved.
  background: globalCssVars.colorFillTertiary,
  color: globalCssVars.colorTextTertiary,

  "& > svg": {
    width: 24,
    height: 24
  }
});

const titleCss = css({
  fontSize: globalCssVars.fontSizeLg,
  fontWeight: globalCssVars.fontWeightStrong,
  color: globalCssVars.colorText,
  letterSpacing: 0
});

const hintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.6,
  maxWidth: 280,
  letterSpacing: 0
});

export interface PropertiesEmptyProps {
  title: string;
  hint?: string;
  icon?: DynamicIconName;
}

/**
 * Empty / error placeholder for the properties panel body. Used when no
 * field is selected, the selected field is missing, or the field's type
 * is not in the registry.
 */
export function PropertiesEmpty({
  hint,
  icon = "settings-2",
  title
}: PropertiesEmptyProps): ReactElement {
  return (
    <div css={wrapperCss}>
      <span css={iconCss}>
        <EditorIcon name={icon} />
      </span>

      <span css={titleCss}>{title}</span>
      {hint ? <span css={hintCss}>{hint}</span> : null}
    </div>
  );
}
