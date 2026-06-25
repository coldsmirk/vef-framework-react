import type { ComponentProps, JSX } from "react";

import type { MenuLayoutMode } from "../../../../stores";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

interface MenuLayoutCardProps extends ComponentProps<"div"> {
  mode: MenuLayoutMode;
}

const cardStyle = css({
  cursor: "pointer",
  display: "flex",
  height: "68px",
  width: "96px",
  gap: "6px",
  padding: "6px",
  border: `2px solid transparent`,
  borderRadius: globalCssVars.borderRadius,
  boxShadow: globalCssVars.shadowSm,
  transition: `border-color ${globalCssVars.motionDurationMid} ease`,
  "&:hover": {
    borderColor: globalCssVars.colorPrimary
  },
  "&.selected": {
    borderColor: globalCssVars.colorPrimary
  },
  ".dark &": {
    boxShadow: "0 1px 3px 0 rgb(255 255 255 / 0.3), 0 1px 2px -1px rgb(255 255 255 / 0.3)"
  }
});

const layoutStyle = {
  header: css({
    flex: "none",
    height: "16px",
    backgroundColor: globalCssVars.colorPrimary,
    borderRadius: "4px"
  }),
  main: css({
    flex: "auto",
    backgroundColor: globalCssVars.colorPrimary200,
    borderRadius: "4px"
  }),
  wrapper: css({
    flex: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  }),
  row: css({
    flex: "auto",
    display: "flex",
    gap: "6px"
  }),
  sidebar: css({
    width: "18px",
    height: "100%",
    backgroundColor: globalCssVars.colorPrimary300,
    borderRadius: "4px"
  })
};

export function MenuLayoutCard({ mode, ...props }: MenuLayoutCardProps): JSX.Element {
  const body = (
    <div css={layoutStyle.wrapper}>
      <div css={layoutStyle.header} />
      <div css={layoutStyle.main} />
    </div>
  );

  if (mode === "horizontal") {
    return (
      <div css={cardStyle} {...props}>
        {body}
      </div>
    );
  }

  if (mode === "mixed") {
    return (
      <div css={cardStyle} {...props}>
        <div css={layoutStyle.wrapper}>
          <div css={layoutStyle.header} />

          <div css={layoutStyle.row}>
            <div css={layoutStyle.sidebar} />
            <div css={layoutStyle.main} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div css={cardStyle} {...props}>
      <div css={layoutStyle.sidebar} />
      {body}
    </div>
  );
}
