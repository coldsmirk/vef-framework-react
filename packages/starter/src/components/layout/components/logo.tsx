import type { LinkComponentProps } from "@tanstack/react-router";
import type { Except } from "@vef-framework-react/shared";

import type { LayoutProps } from "../props";

import { css } from "@emotion/react";
import { Link } from "@tanstack/react-router";
import { globalCssVars, LogoIcon, useThemeTokens } from "@vef-framework-react/components";

import { INDEX_ROUTE_PATH } from "../../../constants";

interface LogoProps extends Except<LinkComponentProps, "to" | "title">, Pick<LayoutProps, "title" | "logo"> {
  isTitleVisible?: boolean;
  /**
   * Render the logo in white, for placement on a colored (primary) surface.
   */
  inverted?: boolean;
}

const logoStyle = css({
  width: "100%",
  height: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  columnGap: globalCssVars.spacingXs
});

const iconStyle = css({
  fontSize: "32px",
  lineHeight: "0"
});

const invertedIconStyle = css({
  // Flatten any mark (the two-tone default or a consumer logo) to clean white on the primary header.
  filter: "brightness(0) invert(1)"
});

const titleStyle = css({
  fontSize: globalCssVars.fontSizeLg,
  fontWeight: "bold",
  color: globalCssVars.colorPrimaryText,
  margin: 0,
  userSelect: "none"
});

const invertedTitleStyle = css({
  color: globalCssVars.colorWhite
});

const hiddenTitleStyle = css({
  display: "none"
});

export function Logo({
  isTitleVisible = true,
  inverted = false,
  title,
  logo,
  ...props
}: LogoProps): React.JSX.Element {
  const { colorPrimary } = useThemeTokens();

  return (
    <Link css={logoStyle} to={INDEX_ROUTE_PATH} {...props}>
      <span css={[iconStyle, inverted && invertedIconStyle]}>
        {logo || <LogoIcon primaryColor={colorPrimary} />}
      </span>

      <h2 css={[titleStyle, inverted && invertedTitleStyle, !isTitleVisible && hiddenTitleStyle]}>
        {title || "VEF中后台管理系统"}
      </h2>
    </Link>
  );
}
