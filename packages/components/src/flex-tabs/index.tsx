import type { ReactElement } from "react";

import type { FlexTabsProps } from "./props";

import { Tabs } from "../tabs";
import * as styles from "./styles";

/**
 * A Tabs that fills its height-bounded column-flex parent: the tab bar stays
 * fixed and the active pane stretches to the remaining space, so pane content
 * manages its own scrolling instead of growing the page. The height-filling
 * counterpart of `Tabs`, mirroring `FlexCard`.
 */
export function FlexTabs(props: FlexTabsProps): ReactElement {
  return (
    <Tabs
      css={styles.container}
      {...props}
    />
  );
}

export type { FlexTabsProps } from "./props";
