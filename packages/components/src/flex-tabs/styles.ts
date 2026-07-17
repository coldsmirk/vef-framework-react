import { css } from "@emotion/react";

// antd v6 renders panes as `.vef-tabs-body-holder > .vef-tabs-body >
// .vef-tabs-content`: the holder is already flex-bounded, but the inner two
// grow with their content unless pinned to the holder's height. Some tab
// configurations wrap the holder in an intermediate div (antd's own styles
// target `> div > .vef-tabs-body-holder` too), and every hop stays a direct
// child so a Tabs nested inside a pane is never restyled from outside.
// The antd class prefix is "vef-", set by the framework's ConfigProvider.
export const container = css({
  flex: 1,
  minHeight: 0,
  "& > .vef-tabs-body-holder, & > div > .vef-tabs-body-holder": {
    minHeight: 0,
    "& > .vef-tabs-body": {
      height: "100%",
      "& > .vef-tabs-content": {
        height: "100%"
      }
    }
  }
});
