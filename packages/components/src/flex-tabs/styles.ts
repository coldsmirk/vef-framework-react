import { css } from "@emotion/react";

// antd v6 renders panes as `.vef-tabs-body-holder > .vef-tabs-body >
// .vef-tabs-content`: the holder is already flex-bounded, but the inner two
// grow with their content unless pinned to the holder's height.
// The antd class prefix is "vef-", set by the framework's ConfigProvider.
export const container = css({
  flex: 1,
  minHeight: 0,
  "& > .vef-tabs-body-holder": {
    minHeight: 0,
    "& > .vef-tabs-body": {
      height: "100%"
    },
    "& .vef-tabs-content": {
      height: "100%"
    }
  }
});
