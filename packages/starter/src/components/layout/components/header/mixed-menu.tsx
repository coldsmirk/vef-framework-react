import type { JSX } from "react";

import { useMixedMenu } from "../../hooks";
import { Menu } from "../menu";

/**
 * Top header menu for the mixed layout: renders only the first-level entries
 * and switches the active section (and thus the sidebar) on select.
 */
export function MixedMenu(): JSX.Element {
  const {
    topLevelItems,
    activeSectionKey,
    selectTopSection
  } = useMixedMenu();

  return (
    <Menu
      items={topLevelItems}
      layout="horizontal"
      selectedKeys={activeSectionKey ? [activeSectionKey] : []}
      onSelectMenu={selectTopSection}
    />
  );
}
