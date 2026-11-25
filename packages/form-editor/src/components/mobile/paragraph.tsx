import type { FC } from "react";

import type { FieldComponentProps, ParagraphField } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { textToneColors } from "./text-tone";

const paragraphCss = css({
  margin: 0,
  color: globalCssVars.colorText,
  fontSize: globalCssVars.fontSize,
  lineHeight: globalCssVars.lineHeight,
  whiteSpace: "pre-wrap"
});

/**
 * Mobile read-only renderer for the static paragraph. antd-mobile ships no
 * Typography primitive, so the text renders into a styled `<p>` themed through
 * `globalCssVars` — matching the body color and size the PC paragraph displays.
 * The semantic tone / bold / italic props are approximated via CSS overrides
 * layered over the base style, mirroring the PC `Typography` knobs.
 */
export const MobileParagraph: FC<FieldComponentProps<ParagraphField, undefined>> = ({ field }) => (
  <p
    css={[
      paragraphCss,
      css({
        color: field.textType ? textToneColors[field.textType] : undefined,
        fontWeight: field.strong ? 600 : undefined,
        fontStyle: field.italic ? "italic" : undefined
      })
    ]}
  >
    {field.text ?? ""}
  </p>
);
