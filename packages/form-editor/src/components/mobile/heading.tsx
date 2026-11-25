import type { FC } from "react";

import type { FieldComponentProps, HeadingField, HeadingLevel } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { DEFAULT_HEADING_LEVEL } from "../display";
import { textToneColors } from "./text-tone";

const headingCss = css({
  margin: 0,
  color: globalCssVars.colorText,
  fontWeight: globalCssVars.fontWeightStrong,
  whiteSpace: "pre-wrap"
});

const headingSizeCss = {
  1: css({ fontSize: globalCssVars.fontSizeHeading1, lineHeight: globalCssVars.lineHeightHeading1 }),
  2: css({ fontSize: globalCssVars.fontSizeHeading2, lineHeight: globalCssVars.lineHeightHeading2 }),
  3: css({ fontSize: globalCssVars.fontSizeHeading3, lineHeight: globalCssVars.lineHeightHeading3 }),
  4: css({ fontSize: globalCssVars.fontSizeHeading4, lineHeight: globalCssVars.lineHeightHeading4 }),
  5: css({ fontSize: globalCssVars.fontSizeHeading5, lineHeight: globalCssVars.lineHeightHeading5 })
} satisfies Record<HeadingLevel, unknown>;

/**
 * Mobile renderer for the static heading. antd-mobile ships no Typography
 * primitive, so the text renders into the matching `<h1>`–`<h5>`, sized by the
 * same heading tokens the PC `Title` uses.
 */
export const MobileHeading: FC<FieldComponentProps<HeadingField, undefined>> = ({ field }) => {
  const level = field.level ?? DEFAULT_HEADING_LEVEL;
  const Tag = `h${level}` as const;

  return (
    <Tag
      css={[
        headingCss,
        headingSizeCss[level],
        css({
          color: field.textType ? textToneColors[field.textType] : undefined,
          textAlign: field.align
        })
      ]}
    >
      {field.text ?? ""}
    </Tag>
  );
};
