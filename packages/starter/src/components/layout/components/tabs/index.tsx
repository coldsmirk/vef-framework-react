import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { MainContentMaximum } from "./main-content-maximum";
import { Reload } from "./reload";
import { TabsContainer } from "./tabs-container";

const tabsStyle = css({
  position: "relative",
  zIndex: 1,
  height: "100%",
  backgroundColor: "var(--vef-color-bg-container)",
  borderBlockEnd: `${globalCssVars.lineWidth} ${globalCssVars.lineType} ${globalCssVars.colorBorderSecondary}`,
  paddingInline: globalCssVars.spacingMd,
  display: "flex",
  gap: globalCssVars.spacingSm
});

const actionsStyle = css({
  flex: "none",
  height: "100%",
  display: "flex",
  columnGap: globalCssVars.spacingXxs,
  alignItems: "center"
});

export function Tabs(): React.JSX.Element {
  return (
    <div css={tabsStyle}>
      <TabsContainer />

      <div css={actionsStyle}>
        <Reload />
        <MainContentMaximum />
      </div>
    </div>
  );
}
